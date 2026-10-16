import { Server } from "socket.io";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { getContactIds, getConversationMeta, isBlockedEitherWay } from "../lib/cache.js";
import {
  addSocket,
  emitToUsers,
  isOnline,
  removeSocket,
  setIO,
  setSocketVisibility,
  userRoom,
} from "../lib/realtime.js";
import { AUTH_COOKIE, verifyToken } from "../lib/tokens.js";
import { idStr, isObjectId, sameId } from "../lib/utils.js";
import { deliverPendingCall, handleCallDisconnect, registerCallHandlers } from "./calls.js";

const OFFLINE_GRACE_MS = 4000; // absorb quick reconnects (mobile networks)
const offlineTimers = new Map();

const parseCookies = (header = "") => {
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    try {
      out[decodeURIComponent(part.slice(0, i).trim())] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // ignore malformed cookie
    }
  }
  return out;
};

/** Users allowed to see `userId`'s online status / last seen. */
async function presenceAudience(userId) {
  const user = await User.findById(userId).select("settings blockedUsers lastSeen").lean();
  if (!user || user.settings?.showLastSeen === false) return { user, ids: [] };
  const contacts = await getContactIds(userId);
  if (!contacts.length) return { user, ids: [] };
  const blocked = new Set((user.blockedUsers || []).map(idStr));
  const viewers = await User.find({
    _id: { $in: contacts },
    "settings.showLastSeen": { $ne: false },
    blockedUsers: { $ne: user._id },
  })
    .select("_id")
    .lean();
  return { user, ids: viewers.map((v) => idStr(v._id)).filter((id) => !blocked.has(id)) };
}

async function broadcastPresence(userId, online) {
  const { user, ids } = await presenceAudience(userId);
  if (!ids.length) return;
  emitToUsers(ids, "presence", { userId, online, lastSeen: online ? null : user?.lastSeen || new Date() });
}

/** Which of my contacts are online right now (and visible to me). */
async function initialPresence(userId) {
  const contacts = (await getContactIds(userId)).filter(isOnline);
  if (!contacts.length) return [];
  const me = await User.findById(userId).select("settings blockedUsers").lean();
  if (!me || me.settings?.showLastSeen === false) return [];
  const mine = new Set((me.blockedUsers || []).map(idStr));
  const visible = await User.find({
    _id: { $in: contacts },
    "settings.showLastSeen": { $ne: false },
    blockedUsers: { $ne: me._id },
  })
    .select("_id")
    .lean();
  return visible.map((u) => idStr(u._id)).filter((id) => !mine.has(id));
}

/** Coming online delivers everything that arrived while we were away. */
async function markDeliveredOnConnect(userId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await Conversation.find({ "members.user": userId, lastMessageAt: { $gt: since } })
    .select("members.user members.lastDeliveredAt lastMessageAt")
    .lean();
  const stale = recent.filter((c) => {
    const me = c.members.find((m) => sameId(m.user, userId));
    return me && (!me.lastDeliveredAt || new Date(me.lastDeliveredAt) < new Date(c.lastMessageAt));
  });
  if (!stale.length) return;

  const at = new Date();
  await Conversation.updateMany(
    { _id: { $in: stale.map((c) => c._id) }, "members.user": userId },
    { $set: { "members.$.lastDeliveredAt": at } }
  );
  for (const c of stale) {
    const others = c.members.filter((m) => !sameId(m.user, userId)).map((m) => m.user);
    emitToUsers(others, "conversation:delivered", { conversationId: idStr(c._id), userIds: [idStr(userId)], at });
  }
}

/** Simple per-socket token bucket for chatty events like typing. */
const makeThrottle = (capacity, refillMs) => {
  let tokens = capacity;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(capacity, tokens + ((now - last) / refillMs) * capacity);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
};

function onConnection(io, socket) {
  const userId = socket.data.userId;
  socket.join(userRoom(userId));

  const first = addSocket(userId, socket.id, socket.handshake.auth?.visible !== false);
  const reconnectedQuickly = offlineTimers.has(userId);
  if (reconnectedQuickly) {
    clearTimeout(offlineTimers.get(userId));
    offlineTimers.delete(userId);
  }
  if (first && !reconnectedQuickly) broadcastPresence(userId, true).catch(() => {});

  initialPresence(userId)
    .then((online) => socket.emit("presence:init", { online }))
    .catch(() => {});
  markDeliveredOnConnect(userId).catch((err) => console.warn("[socket] delivery sync failed:", err.message));
  deliverPendingCall(socket).catch(() => {});

  const typingAllowed = makeThrottle(12, 5000);
  socket.on("typing", async (payload) => {
    try {
      const { conversationId, isTyping, recording } = payload || {};
      if (!isObjectId(String(conversationId)) || !typingAllowed()) return;
      const meta = await getConversationMeta(conversationId);
      if (!meta || !meta.members.includes(userId)) return;
      const others = meta.members.filter((id) => id !== userId);
      if (meta.type === "direct" && others[0] && (await isBlockedEitherWay(userId, others[0]))) return;
      emitToUsers(others, "typing", {
        conversationId: String(conversationId),
        userId,
        isTyping: Boolean(isTyping),
        recording: Boolean(recording),
      });
    } catch {
      // typing indicators are best-effort
    }
  });

  socket.on("visibility", (payload) => setSocketVisibility(socket.id, payload?.visible !== false));

  registerCallHandlers(io, socket);

  socket.on("disconnect", () => {
    const last = removeSocket(userId, socket.id);
    handleCallDisconnect(socket);
    if (!last) return;
    const timer = setTimeout(async () => {
      offlineTimers.delete(userId);
      if (isOnline(userId)) return;
      try {
        await User.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } });
        await broadcastPresence(userId, false);
      } catch {
        // ignore (e.g. during shutdown)
      }
    }, OFFLINE_GRACE_MS);
    offlineTimers.set(userId, timer);
  });
}

/**
 * Creates the Socket.IO server. Connections are authenticated with the same
 * JWT as the REST API (cookie, or `auth.token` for cross-site frontends).
 * The old server trusted a `?userId=` query parameter, so anyone could
 * impersonate anyone and receive their messages and calls.
 */
export function createSocketServer(httpServer, { isAllowedOrigin }) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin)),
      credentials: true,
    },
    // Also enforce the origin on WebSocket upgrades (CORS headers don't
    // apply there) to stop cross-site WebSocket hijacking.
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, !origin || isAllowedOrigin(origin, req.headers["x-forwarded-host"] || req.headers.host));
    },
    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 20000,
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || parseCookies(socket.handshake.headers.cookie)[AUTH_COOKIE];
      const decoded = verifyToken(token);
      if (!decoded) return next(new Error("unauthorized"));
      const user = await User.findById(decoded.userId).select("_id tokenVersion").lean();
      if (!user || (user.tokenVersion || 0) !== decoded.version) return next(new Error("unauthorized"));
      socket.data.userId = idStr(user._id);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => onConnection(io, socket));
  return io;
}

export const clearPresenceTimers = () => {
  for (const t of offlineTimers.values()) clearTimeout(t);
  offlineTimers.clear();
};
