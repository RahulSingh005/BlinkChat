import { create } from "zustand";
import { api } from "../lib/api";
import { storage } from "../lib/storage";

const SEEN_KEY = "blinkchat.callsSeenAt";
let refetchTimer = 0;

const isMissed = (c) => !c.outgoing && ["missed", "unavailable"].includes(c.message.call?.status);

/** Call history across 1:1 chats (Calls tab). */
export const useCallLogStore = create((set, get) => ({
  items: [],
  loaded: false,
  loadingMore: false,
  hasMore: false,
  seenAt: storage.get(SEEN_KEY, null),

  fetch: async () => {
    try {
      const res = await api.get("/calls/history", { params: { limit: 50 } });
      set({ items: res.data.calls, hasMore: res.data.hasMore, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  refetchSoon: () => {
    clearTimeout(refetchTimer);
    refetchTimer = setTimeout(() => get().fetch(), 600);
  },

  loadMore: async () => {
    const { items, hasMore, loadingMore } = get();
    if (!hasMore || loadingMore || !items.length) return;
    set({ loadingMore: true });
    try {
      const res = await api.get("/calls/history", { params: { limit: 50, before: items.at(-1).message.createdAt } });
      set((s) => ({ items: [...s.items, ...res.data.calls], hasMore: res.data.hasMore, loadingMore: false }));
    } catch {
      set({ loadingMore: false });
    }
  },

  /** Opening the Calls tab clears the missed-call badge. */
  markSeen: () => {
    const seenAt = new Date().toISOString();
    storage.set(SEEN_KEY, seenAt);
    set({ seenAt });
  },

  reset: () => set({ items: [], loaded: false, hasMore: false }),
}));

export const selectMissedCount = (s) =>
  s.items.filter((c) => isMissed(c) && (!s.seenAt || new Date(c.message.createdAt) > new Date(s.seenAt))).length;

export { isMissed };
