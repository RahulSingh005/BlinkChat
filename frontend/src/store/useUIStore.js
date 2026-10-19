import { create } from "zustand";

/** Global overlays: dialogs, sheets, lightbox, confirmation prompts. */
export const useUIStore = create((set, get) => ({
  newChatOpen: false,
  newGroupOpen: false,
  infoOpen: false, // contact / group details panel
  searchOpen: false, // in-chat message search
  searchQuery: "",
  lightbox: null, // { items: [{ url, kind, name }], index }
  forward: null, // message
  remind: null, // message
  schedule: null, // { conversationId, draft }
  messageSheet: null, // { message, conversationId } (mobile long-press menu)
  messageInfo: null, // { messageId, conversationId }
  pollVotes: null, // { messageId, conversationId }
  invite: null, // conversationId (group invite link sheet)
  shareProfile: false, // my QR code / profile link
  confirm: null, // { title, body, confirmLabel, danger, checkbox, resolve }

  open: (key, value = true) => set({ [key]: value }),
  close: (key) => set({ [key]: key.endsWith("Open") ? false : null }),

  /**
   * Promise-based confirmation dialog (replaces window.confirm).
   * Resolves to false, or to true / { checked } when confirmed.
   */
  ask: ({ title, body = "", confirmLabel = "Confirm", danger = false, checkbox = null }) =>
    new Promise((resolve) => {
      get().confirm?.resolve(false);
      set({ confirm: { title, body, confirmLabel, danger, checkbox, resolve } });
    }),

  answer: (value) => {
    const pending = get().confirm;
    set({ confirm: null });
    pending?.resolve(value);
  },
}));
