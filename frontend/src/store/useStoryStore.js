import { create } from "zustand";
import { api } from "../lib/api";

let refetchTimer = 0;

/** Status updates ("stories") from people you chat with, plus your own. */
export const useStoryStore = create((set, get) => ({
  mine: null, // { user, stories, lastAt }
  others: [], // [{ user, stories, lastAt, hasUnseen }]
  loaded: false,
  error: null,
  viewer: null, // { userIds: [], index: 0, start: 0 }
  composer: null, // { kind: "text" | "media", file? }

  fetch: async () => {
    try {
      const res = await api.get("/stories");
      set({ mine: res.data.mine, others: res.data.others, loaded: true, error: null });
    } catch {
      set({ loaded: true, error: "Couldn't load status updates" });
    }
  },

  /** Coalesces bursts of realtime events into one refetch. */
  refetchSoon: () => {
    clearTimeout(refetchTimer);
    refetchTimer = setTimeout(() => get().fetch(), 400);
  },

  create: async (payload) => {
    const res = await api.post("/stories", payload);
    await get().fetch();
    return res.data.story;
  },

  remove: async (storyId) => {
    await api.delete(`/stories/${storyId}`);
    get()._dropStory(storyId);
  },

  markViewed: (storyId) => {
    const s = get();
    const owner = s.others.find((g) => g.stories.some((st) => st._id === storyId));
    if (!owner) return;
    const story = owner.stories.find((st) => st._id === storyId);
    if (story.viewed) return;
    set({
      others: s.others.map((g) =>
        g === owner
          ? (() => {
              const stories = g.stories.map((st) => (st._id === storyId ? { ...st, viewed: true } : st));
              return { ...g, stories, hasUnseen: stories.some((st) => !st.viewed) };
            })()
          : g
      ),
    });
    api.post(`/stories/${storyId}/view`).catch(() => {});
  },

  react: async (storyId, emoji) => {
    const setReaction = (value) =>
      set((s) => ({
        others: s.others.map((g) => ({ ...g, stories: g.stories.map((st) => (st._id === storyId ? { ...st, myReaction: value } : st)) })),
      }));
    const previous = get().others.flatMap((g) => g.stories).find((st) => st._id === storyId)?.myReaction || "";
    setReaction(emoji); // show it right away
    try {
      await api.post(`/stories/${storyId}/react`, { emoji });
    } catch (err) {
      setReaction(previous);
      throw err;
    }
  },

  reply: async (storyId, text) => (await api.post(`/stories/${storyId}/reply`, { text })).data,

  viewers: async (storyId) => (await api.get(`/stories/${storyId}/viewers`)).data,

  _dropStory: (storyId) =>
    set((s) => {
      const strip = (g) => (g ? { ...g, stories: g.stories.filter((st) => st._id !== storyId) } : g);
      const mine = strip(s.mine);
      return {
        mine: mine?.stories.length ? mine : null,
        others: s.others.map(strip).filter((g) => g.stories.length).map((g) => ({ ...g, hasUnseen: g.stories.some((st) => !st.viewed) })),
      };
    }),

  onViewed: ({ storyId, viewCount }) =>
    set((s) => (s.mine ? { mine: { ...s.mine, stories: s.mine.stories.map((st) => (st._id === storyId ? { ...st, viewCount } : st)) } } : {})),

  openViewer: (userIds, index = 0) => set({ viewer: { userIds, index } }),
  closeViewer: () => set({ viewer: null }),
  openComposer: (composer = { kind: "text" }) => set({ composer }),
  closeComposer: () => set({ composer: null }),

  reset: () => set({ mine: null, others: [], loaded: false, error: null, viewer: null, composer: null }),
}));

export const selectUnseenStories = (s) => s.others.filter((g) => g.hasUnseen).length;
