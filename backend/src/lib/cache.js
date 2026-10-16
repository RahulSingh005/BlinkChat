import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { idStr } from "./utils.js";

/**
 * Tiny TTL caches for hot realtime paths (typing indicators, presence) so a
 * keystroke doesn't cost a database round-trip. Entries are invalidated
 * explicitly whenever membership or block lists change.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 5000;

const makeCache = () => {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (hit.exp < Date.now()) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      if (map.size >= MAX_ENTRIES) map.delete(map.keys().next().value);
      map.set(key, { value, exp: Date.now() + TTL_MS });
    },
    delete(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
};

const conversationMeta = makeCache();
const blockLists = makeCache();
const contactLists = makeCache();

/** { type, members: string[] } or null */
export async function getConversationMeta(conversationId) {
  const key = idStr(conversationId);
  const cached = conversationMeta.get(key);
  if (cached !== undefined) return cached;
  const conv = await Conversation.findById(key).select("type members.user").lean();
  const value = conv ? { type: conv.type, members: conv.members.map((m) => idStr(m.user)) } : null;
  conversationMeta.set(key, value);
  return value;
}

export const invalidateConversation = (conversationId) => conversationMeta.delete(idStr(conversationId));

/** Set of user ids that `userId` has blocked. */
export async function getBlockedSet(userId) {
  const key = idStr(userId);
  const cached = blockLists.get(key);
  if (cached) return cached;
  const user = await User.findById(key).select("blockedUsers").lean();
  const value = new Set((user?.blockedUsers || []).map(idStr));
  blockLists.set(key, value);
  return value;
}

export const invalidateBlocks = (userId) => blockLists.delete(idStr(userId));

export async function isBlockedEitherWay(a, b) {
  const [aBlocks, bBlocks] = await Promise.all([getBlockedSet(a), getBlockedSet(b)]);
  return aBlocks.has(idStr(b)) || bBlocks.has(idStr(a));
}

/** Everyone who shares at least one conversation with `userId`. */
export async function getContactIds(userId) {
  const key = idStr(userId);
  const cached = contactLists.get(key);
  if (cached) return cached;
  const ids = await Conversation.distinct("members.user", { "members.user": key });
  const value = ids.map(idStr).filter((id) => id !== key);
  contactLists.set(key, value);
  return value;
}

export const invalidateContacts = (userIds) => {
  for (const id of [].concat(userIds)) contactLists.delete(idStr(id));
};

export const clearCaches = () => {
  conversationMeta.clear();
  blockLists.clear();
  contactLists.clear();
};
