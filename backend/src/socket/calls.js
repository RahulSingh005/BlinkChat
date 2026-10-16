import { randomUUID } from "node:crypto";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { isBlockedEitherWay } from "../lib/cache.js";
import { sendPushToUser } from "../lib/push.js";
import { emitToSocket, emitToUser, getUserSocketIds, hasVisibleSocket, isOnline } from "../lib/realtime.js";
import { publicUser } from "../lib/serializers.js";
import { idStr, isObjectId, sameId } from "../lib/utils.js";
import { createMessage } from "../services/message.service.js";

/**
 * WebRTC signaling for 1:1 voice/video calls.
 *
 * Fixes over the previous version:
 *  - ICE candidates sent before the callee answered were dropped (the callee
 *    had no RTCPeerConnection yet), so most calls never connected. They are
 *    now buffered here and flushed to the answering device.
 *  - Calls ring on every device; answering on one stops the others.
 *  - Unanswered calls time out, short network drops get a reconnect grace
 *    period, and every call is logged in the chat (missed/declined/duration).
 */
const RING_TIMEOUT_MS = 45_000;
const RECONNECT_GRACE_MS = 20_000;
const MAX_BUFFERED_CANDIDATES = 200;

const calls = new Map(); // callId -> call
const userCalls = new Map(); // userId -> callId

const ack = (cb, payload) => {
  if (typeof cb === "function") cb(payload);
};

const otherParty = (call, userId) => (sameId(call.callerId, userId) ? call.calleeId : call.callerId);

function finish(call) {
  clearTimeout(call.ringTimer);
  clearTimeout(call.callerGrace);
  clearTimeout(call.calleeGrace);
  calls.delete(call.id);
  if (userCalls.get(call.callerId) === call.id) userCalls.delete(call.callerId);
  if (userCalls.get(call.calleeId) === call.id) userCalls.delete(call.calleeId);
}

/** Writes the call into the conversation (once) and notifies a missed callee. */
async function logCall(call, status) {
  if (call.logged) return;
  call.logged = true;
  try {
    const conv = await Conversation.findById(call.conversationId);
    if (!conv) return;
    const duration = status === "completed" && call.answeredAt ? Math.round((Date.now() - call.answeredAt) / 1000) : 0;
    await createMessage({
      conversation: conv,
      senderId: call.callerId,
      type: "call",
      call: { kind: call.type, status, duration },
      countsAsUnread: status === "missed" || status === "unavailable",
      notify: false,
    });
    if (status === "missed" || status === "unavailable") {
      const caller = await User.findById(call.callerId).select("fullName profilePic").lean();
      await sendPushToUser(
        call.calleeId,
        {
          type: "call-missed",
          title: caller?.fullName || "BlinkChat",
          body: `Missed ${call.type} call`,
          icon: caller?.profilePic || undefined,
          tag: `call-${call.id}`,
          url: `/chat/${call.conversationId}`,
          conversationId: call.conversationId,
        },
        { ttl: 24 * 3600, urgency: "normal" }
      );
    }
  } catch (err) {
    console.warn("[calls] could not log call:", err.message);
  }
}

function endCall(call, { status, reason, notify = [] }) {
  for (const target of notify) {
    if (target.socketId) emitToSocket(target.socketId, "call:ended", { callId: call.id, reason });
    else if (target.userId) emitToUser(target.userId, "call:ended", { callId: call.id, reason });
  }
  finish(call);
  logCall(call, status);
}

async function validateStart(userId, conversationId) {
  if (!isObjectId(String(conversationId))) return { error: "not_found" };
  const conv = await Conversation.findOne({ _id: conversationId, "members.user": userId }).select("type members.user").lean();
  if (!conv) return { error: "not_found" };
  if (conv.type !== "direct") return { error: "group_unsupported" };
  const peer = conv.members.find((m) => !sameId(m.user, userId));
  if (!peer) return { error: "not_found" };
  const peerId = idStr(peer.user);
  if (!(await User.exists({ _id: peerId }))) return { error: "not_found" };
  if (await isBlockedEitherWay(userId, peerId)) return { error: "blocked" };
  return { conv, peerId };
}

async function startCall(io, socket, payload, cb) {
  const userId = socket.data.userId;
  const { conversationId, type, offer } = payload || {};
  if (!["voice", "video"].includes(type) || !offer?.sdp || String(offer.sdp).length > 20000) {
    return ack(cb, { ok: false, reason: "invalid" });
  }
  if (userCalls.has(userId)) return ack(cb, { ok: false, reason: "already_in_call" });

  const { error, peerId } = await validateStart(userId, conversationId);
  if (error) return ack(cb, { ok: false, reason: error });

  const call = {
    id: randomUUID(),
    conversationId: idStr(conversationId),
    type,
    callerId: userId,
    calleeId: peerId,
    callerSocket: socket.id,
    calleeSocket: null,
    offer: { type: "offer", sdp: String(offer.sdp) },
    state: "ringing",
    createdAt: Date.now(),
    answeredAt: null,
    callerCandidates: [],
    calleeCandidates: [],
  };

  if (!isOnline(peerId) || userCalls.has(peerId)) {
    // Callee is offline or busy: log a missed call so they see it later.
    call.logged = false;
    const reason = userCalls.has(peerId) ? "busy" : "offline";
    logCall(call, "unavailable");
    return ack(cb, { ok: false, reason });
  }

  calls.set(call.id, call);
  userCalls.set(userId, call.id);
  userCalls.set(peerId, call.id);

  const caller = await User.findById(userId).select("fullName profilePic settings status focus blockedUsers timezone lastSeen about createdAt").lean();
  const callee = await User.findById(peerId).select("_id settings").lean();
  emitToUser(peerId, "call:incoming", incomingPayload(call, caller, callee));

  if (!hasVisibleSocket(peerId)) {
    sendPushToUser(
      peerId,
      {
        type: "call",
        title: caller?.fullName || "Incoming call",
        body: `Incoming ${type} call`,
        icon: caller?.profilePic || undefined,
        tag: `call-${call.id}`,
        url: `/chat/${call.conversationId}`,
        conversationId: call.conversationId,
        requireInteraction: true,
      },
      { ttl: 45, urgency: "high" }
    ).catch(() => {});
  }

  call.ringTimer = setTimeout(() => {
    if (calls.get(call.id)?.state !== "ringing") return;
    endCall(call, {
      status: "missed",
      reason: "timeout",
      notify: [{ socketId: call.callerSocket }, { userId: call.calleeId }],
    });
  }, RING_TIMEOUT_MS);

  ack(cb, { ok: true, callId: call.id });
}

function incomingPayload(call, caller, callee) {
  return {
    callId: call.id,
    conversationId: call.conversationId,
    type: call.type,
    offer: call.offer,
    from: caller ? publicUser(caller, callee) : { _id: call.callerId, fullName: "Unknown" },
    startedAt: call.createdAt,
  };
}

function acceptCall(socket, payload, cb) {
  const call = calls.get(payload?.callId);
  const userId = socket.data.userId;
  if (!call || call.state !== "ringing" || !sameId(call.calleeId, userId)) return ack(cb, { ok: false, reason: "gone" });
  if (!payload?.answer?.sdp || String(payload.answer.sdp).length > 20000) return ack(cb, { ok: false, reason: "invalid" });

  call.state = "active";
  call.calleeSocket = socket.id;
  call.answeredAt = Date.now();
  clearTimeout(call.ringTimer);

  emitToSocket(call.callerSocket, "call:accepted", {
    callId: call.id,
    answer: { type: "answer", sdp: String(payload.answer.sdp) },
  });
  // Stop ringing on the callee's other devices.
  for (const sid of getUserSocketIds(userId)) {
    if (sid !== socket.id) emitToSocket(sid, "call:taken", { callId: call.id });
  }
  // Flush candidates gathered while ringing, in both directions.
  for (const candidate of call.callerCandidates.splice(0)) emitToSocket(socket.id, "call:signal", { callId: call.id, candidate });
  for (const candidate of call.calleeCandidates.splice(0)) emitToSocket(call.callerSocket, "call:signal", { callId: call.id, candidate });

  ack(cb, { ok: true });
}

function declineCall(socket, payload) {
  const call = calls.get(payload?.callId);
  const userId = socket.data.userId;
  if (!call || call.state !== "ringing" || !sameId(call.calleeId, userId)) return;
  emitToSocket(call.callerSocket, "call:declined", { callId: call.id });
  for (const sid of getUserSocketIds(userId)) {
    if (sid !== socket.id) emitToSocket(sid, "call:taken", { callId: call.id });
  }
  finish(call);
  logCall(call, "declined");
}

function hangUp(socket, payload) {
  const call = calls.get(payload?.callId);
  const userId = socket.data.userId;
  if (!call || (!sameId(call.callerId, userId) && !sameId(call.calleeId, userId))) return;

  if (call.state === "ringing") {
    if (sameId(call.calleeId, userId)) return declineCall(socket, payload);
    return endCall(call, { status: "missed", reason: "canceled", notify: [{ userId: call.calleeId }] });
  }
  const isCaller = sameId(call.callerId, userId);
  endCall(call, {
    status: "completed",
    reason: "hangup",
    notify: [isCaller ? { socketId: call.calleeSocket } : { socketId: call.callerSocket }],
  });
}

function relaySignal(socket, payload) {
  const call = calls.get(payload?.callId);
  const userId = socket.data.userId;
  const candidate = payload?.candidate;
  if (!call || !candidate || typeof candidate !== "object") return;

  if (sameId(call.callerId, userId)) {
    if (call.calleeSocket) emitToSocket(call.calleeSocket, "call:signal", { callId: call.id, candidate });
    else if (call.callerCandidates.length < MAX_BUFFERED_CANDIDATES) call.callerCandidates.push(candidate);
  } else if (sameId(call.calleeId, userId)) {
    if (call.state === "active" && call.calleeSocket === socket.id) {
      emitToSocket(call.callerSocket, "call:signal", { callId: call.id, candidate });
    } else if (call.calleeCandidates.length < MAX_BUFFERED_CANDIDATES) {
      call.calleeCandidates.push(candidate);
    }
  }
}

function relayMedia(socket, payload) {
  const call = calls.get(payload?.callId);
  const userId = socket.data.userId;
  if (!call || call.state !== "active") return;
  const target = sameId(call.callerId, userId) ? call.calleeSocket : call.callerSocket;
  emitToSocket(target, "call:media", {
    callId: call.id,
    audio: payload.audio !== false,
    video: payload.video !== false,
    screen: Boolean(payload.screen),
  });
}

/** A reconnecting client re-attaches to its call within the grace window. */
function rejoinCall(socket, payload, cb) {
  const call = calls.get(payload?.callId);
  const userId = socket.data.userId;
  if (!call) return ack(cb, { ok: false });
  if (sameId(call.callerId, userId)) {
    call.callerSocket = socket.id;
    clearTimeout(call.callerGrace);
  } else if (sameId(call.calleeId, userId) && call.state === "active") {
    call.calleeSocket = socket.id;
    clearTimeout(call.calleeGrace);
  } else {
    return ack(cb, { ok: false });
  }
  ack(cb, { ok: true, state: call.state });
}

export function handleCallDisconnect(socket) {
  const userId = socket.data.userId;
  const callId = userCalls.get(userId);
  const call = callId && calls.get(callId);
  if (!call) return;

  if (call.callerSocket === socket.id) {
    clearTimeout(call.callerGrace);
    call.callerGrace = setTimeout(() => {
      if (!calls.has(call.id)) return;
      if (call.state === "ringing") {
        endCall(call, { status: "missed", reason: "canceled", notify: [{ userId: call.calleeId }] });
      } else {
        endCall(call, { status: "completed", reason: "disconnected", notify: [{ socketId: call.calleeSocket }] });
      }
    }, RECONNECT_GRACE_MS);
  } else if (call.calleeSocket === socket.id) {
    clearTimeout(call.calleeGrace);
    call.calleeGrace = setTimeout(() => {
      if (!calls.has(call.id)) return;
      endCall(call, { status: "completed", reason: "disconnected", notify: [{ socketId: call.callerSocket }] });
    }, RECONNECT_GRACE_MS);
  }
}

/** Re-sends a still-ringing incoming call to a device that just connected. */
export async function deliverPendingCall(socket) {
  const userId = socket.data.userId;
  const callId = userCalls.get(userId);
  const call = callId && calls.get(callId);
  if (!call || call.state !== "ringing" || !sameId(call.calleeId, userId)) return;
  const caller = await User.findById(call.callerId).select("fullName profilePic settings status focus blockedUsers timezone lastSeen about createdAt").lean();
  const callee = await User.findById(userId).select("_id settings").lean();
  socket.emit("call:incoming", incomingPayload(call, caller, callee));
}

export function registerCallHandlers(io, socket) {
  socket.on("call:start", (payload, cb) => {
    startCall(io, socket, payload, cb).catch((err) => {
      console.warn("[calls] start failed:", err.message);
      ack(cb, { ok: false, reason: "error" });
    });
  });
  socket.on("call:accept", (payload, cb) => acceptCall(socket, payload, cb));
  socket.on("call:decline", (payload) => declineCall(socket, payload));
  socket.on("call:end", (payload) => hangUp(socket, payload));
  socket.on("call:signal", (payload) => relaySignal(socket, payload));
  socket.on("call:media", (payload) => relayMedia(socket, payload));
  socket.on("call:rejoin", (payload, cb) => rejoinCall(socket, payload, cb));
}

// Test helper.
export const resetCalls = () => {
  for (const call of calls.values()) finish(call);
};

export const activeCallFor = (userId) => calls.get(userCalls.get(idStr(userId)));

export { otherParty };
