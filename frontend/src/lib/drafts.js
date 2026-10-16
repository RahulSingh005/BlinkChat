import { storage } from "./storage";

// Unsent text per conversation survives reloads and chat switching.
const KEY = "blinkchat.drafts";
let cache = storage.get(KEY, {});
let timer = null;
const listeners = new Set();

export const getDraft = (conversationId) => cache[conversationId] || "";

export function setDraft(conversationId, text) {
  const value = text.trim() ? text : "";
  if ((cache[conversationId] || "") === value) return;
  cache = { ...cache };
  if (value) cache[conversationId] = value;
  else delete cache[conversationId];
  listeners.forEach((fn) => fn(cache));
  clearTimeout(timer);
  timer = setTimeout(() => storage.set(KEY, cache), 400);
}

export const subscribeDrafts = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const allDrafts = () => cache;

export function clearAllDrafts() {
  cache = {};
  storage.remove(KEY);
  listeners.forEach((fn) => fn(cache));
}
