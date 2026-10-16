import { create } from "zustand";
import { api } from "../lib/api";

export const useReminderStore = create((set, get) => ({
  items: [],
  loaded: false,

  fetch: async () => {
    try {
      const res = await api.get("/reminders");
      set({ items: res.data.reminders, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  create: async (messageId, remindAt, note = "") => {
    const res = await api.post(`/messages/${messageId}/remind`, { remindAt: remindAt.toISOString(), note });
    set((s) => ({ items: [...s.items.filter((r) => r._id !== res.data.reminder._id), res.data.reminder] }));
    return res.data.reminder;
  },

  onDue: (reminder) =>
    set((s) => ({ items: [...s.items.filter((r) => r._id !== reminder._id), reminder] })),

  markDone: async (id) => {
    set((s) => ({ items: s.items.filter((r) => r._id !== id) }));
    await api.patch(`/reminders/${id}`, { done: true }).catch(() => get().fetch());
  },

  snooze: async (id, until) => {
    const res = await api.patch(`/reminders/${id}`, { remindAt: until.toISOString() });
    set((s) => ({ items: s.items.map((r) => (r._id === id ? res.data.reminder : r)) }));
  },

  remove: async (id) => {
    set((s) => ({ items: s.items.filter((r) => r._id !== id) }));
    await api.delete(`/reminders/${id}`).catch(() => get().fetch());
  },

  reset: () => set({ items: [], loaded: false }),
}));

export const selectDueCount = (s) => s.items.filter((r) => r.status === "fired").length;
