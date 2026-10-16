import { idStr, uniqueIds } from "./utils.js";

/**
 * Holds the Socket.IO server and in-memory presence. Every socket joins a
 * per-user room, so emitting to a user reaches all of their devices/tabs.
 *
 * NOTE: presence is per-process. To run several server instances, add the
 * Socket.IO Redis adapter and move these maps to Redis.
 */
let io = null;

const userSockets = new Map(); // userId -> Set<socketId>
const socketVisibility = new Map(); // socketId -> boolean (tab visible?)

export const setIO = (instance) => {
  io = instance;
};
export const getIO = () => io;

export const userRoom = (userId) => `user:${idStr(userId)}`;

export const emitToUser = (userId, event, payload) => {
  if (io && userId) io.to(userRoom(userId)).emit(event, payload);
};

export const emitToUsers = (userIds, event, payload) => {
  const rooms = uniqueIds(userIds).map(userRoom);
  if (io && rooms.length) io.to(rooms).emit(event, payload);
};

export const emitToSocket = (socketId, event, payload) => {
  if (io && socketId) io.to(socketId).emit(event, payload);
};

/** Returns true when this is the user's first connected socket. */
export const addSocket = (userId, socketId, visible = true) => {
  const key = idStr(userId);
  let set = userSockets.get(key);
  const first = !set || set.size === 0;
  if (!set) {
    set = new Set();
    userSockets.set(key, set);
  }
  set.add(socketId);
  socketVisibility.set(socketId, Boolean(visible));
  return first;
};

/** Returns true when the user has no sockets left. */
export const removeSocket = (userId, socketId) => {
  const key = idStr(userId);
  socketVisibility.delete(socketId);
  const set = userSockets.get(key);
  if (!set) return true;
  set.delete(socketId);
  if (set.size === 0) {
    userSockets.delete(key);
    return true;
  }
  return false;
};

export const setSocketVisibility = (socketId, visible) => {
  if (socketVisibility.has(socketId)) socketVisibility.set(socketId, Boolean(visible));
};

export const isOnline = (userId) => (userSockets.get(idStr(userId))?.size || 0) > 0;

export const getUserSocketIds = (userId) => [...(userSockets.get(idStr(userId)) || [])];

/** True when at least one of the user's tabs is in the foreground. */
export const hasVisibleSocket = (userId) => getUserSocketIds(userId).some((sid) => socketVisibility.get(sid));

export const onlineUserIds = () => [...userSockets.keys()];

export const disconnectUserSockets = (userId, { exceptSocketId } = {}) => {
  if (!io) return;
  for (const sid of getUserSocketIds(userId)) {
    if (sid === exceptSocketId) continue;
    io.sockets.sockets.get(sid)?.disconnect(true);
  }
};

// Test helper.
export const resetPresence = () => {
  userSockets.clear();
  socketVisibility.clear();
};
