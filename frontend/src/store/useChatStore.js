import { create } from "zustand";
import toast from "react-hot-toast";
import { api, errorMessage } from "../lib/api";
import { clientId } from "../lib/ids";
import { storage } from "../lib/storage";
import { uploadFile } from "../lib/upload";
import { useAuthStore } from "./useAuthStore";

// In-memory send state for messages with files (not serializable).
const pendingEntries = new Map();

const OUTBOX_KEY = "blinkchat.outbox";
const PAGE = 40;
const TYPING_TTL = 6000;

const emptyThread = () => ({
  items: [],
  hasMore: true,
  hasNewer: false,
  loaded: false,
  loading: false,
  loadingOlder: false,
  loadingNewer: false,
  error: null,
});

const meId = () => useAuthStore.getState().authUser?._id;

const time = (m) => new Date(m.createdAt).getTime();
const byTime = (a, b) => time(a) - time(b) || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);

/** Merge messages into a sorted list, replacing by _id or optimistic clientId. */
function mergeMessages(items, incoming) {
  const out = items.slice();
  let needsSort = false;
  for (const msg of incoming) {
    let idx = -1;
    for (let i = out.length - 1; i >= 0; i -= 1) {
      const m = out[i];
      if (m._id === msg._id || (msg.clientId && m.clientId === msg.clientId)) {
        idx = i;
        break;
      }
    }
    if (idx !== -1) {
      const prev = out[idx];
      // Carry local previews over so freshly sent images don't re-download.
      let next =
        prev.attachments?.some((a) => a.previewUrl) && msg.attachments?.length
          ? { ...msg, attachments: msg.attachments.map((a, i) => ({ ...a, previewUrl: a.previewUrl || prev.attachments[i]?.previewUrl })) }
          : msg;
      if (next.starred === undefined && prev.starred !== undefined) next = { ...next, starred: prev.starred };
      if (prev.viewOnceMedia && !next.viewOnceMedia) next = { ...next, viewOnceMedia: prev.viewOnceMedia };
      out[idx] = next;
      needsSort = true;
    } else {
      if (out.length && byTime(out[out.length - 1], msg) > 0) needsSort = true;
      out.push(msg);
    }
  }
  if (needsSort) out.sort(byTime);
  return out;
}

const isNewer = (a, b) => !b || time(a) >= time(b);

const countsAsUnread = (msg) =>
  msg.type === "user" || (msg.type === "call" && ["missed", "unavailable"].includes(msg.call?.status));

const replySnapshot = (m) =>
  m
    ? {
        message: m._id,
        sender: m.sender,
        text: (m.text || (m.poll ? m.poll.question : "") || "").slice(0, 200),
        kind: m.attachments?.[0]?.kind || (m.type === "call" ? "call" : m.poll ? "poll" : m.location ? "location" : m.contactCard ? "contact" : null),
      }
    : null;

/** Read/delivery state of one of *my* messages in a conversation. */
export function receiptFor(msg, conv) {
  if (msg.status === "pending") return "pending";
  if (msg.status === "failed") return "failed";
  const me = meId();
  const others = (conv?.members || []).filter((m) => m.user._id !== me && !m.user.deleted);
  if (!others.length) return "sent";
  const t = time(msg);
  const reached = (d) => d && new Date(d).getTime() >= t;
  if (others.every((m) => reached(m.lastReadAt))) return "read";
  if (others.every((m) => reached(m.lastDeliveredAt) || reached(m.lastReadAt))) return "delivered";
  return "sent";
}

/** Conversation that needs my reply: read, last word is theirs, quiet 30+ min. */
export function needsReply(conv, me = meId()) {
  const last = conv.lastMessage;
  if (conv.type !== "direct" || !last || last.type !== "user" || last.deletedAt) return false;
  if (last.sender === me || conv.me.unreadCount > 0 || conv.me.archived || conv.blocked) return false;
  return Date.now() - time(last) > 30 * 60 * 1000;
}

export const peerOf = (conv, me = meId()) =>
  conv?.type === "direct" ? conv.members.find((m) => m.user._id !== me)?.user || null : null;

export const conversationTitle = (conv, me = meId()) =>
  conv?.type === "group" ? conv.name || "Group" : conv?.type === "self" ? "Saved Messages" : peerOf(conv, me)?.fullName || "Chat";

/** Download helper for exports (works with cookie and bearer auth). */
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const isMuted = (conv) => Boolean(conv?.me?.mutedUntil && new Date(conv.me.mutedUntil) > new Date());

const viewing = (state, conversationId) =>
  state.activeId === conversationId && document.visibilityState === "visible";

const loadOutbox = () => storage.get(OUTBOX_KEY, []).filter((o) => o?.conversationId && o?.payload);

export const useChatStore = create((set, get) => ({
  conversations: {},
  loaded: false,
  loadError: null,
  activeId: null,
  threads: {}, // conversationId -> thread
  typing: {}, // conversationId -> { userId: { at, recording } }
  replyTo: {}, // conversationId -> message
  editing: {}, // conversationId -> message
  anchors: {}, // conversationId -> { since, count } (unread divider + catch-up)
  jump: null, // { conversationId, messageId, nonce }
  translations: {}, // messageId -> { text } | { same } | { loading } | { error }
  scheduled: {}, // conversationId -> items
  outbox: loadOutbox(),
  flushing: false,

  // ---- Conversations --------------------------------------------------------

  fetchConversations: async () => {
    try {
      const res = await api.get("/conversations");
      const map = {};
      for (const c of res.data.conversations) map[c._id] = c;
      set({ conversations: map, loaded: true, loadError: null });
    } catch (err) {
      set({ loaded: true, loadError: errorMessage(err, "Couldn't load your chats") });
    }
  },

  fetchConversation: async (conversationId) => {
    try {
      const res = await api.get(`/conversations/${conversationId}`);
      get().upsertConversation(res.data.conversation);
      return res.data.conversation;
    } catch {
      return null;
    }
  },

  upsertConversation: (conv) =>
    set((s) => {
      const prev = s.conversations[conv._id];
      const next = { ...prev, ...conv };
      if (conv.lastMessage === undefined && prev) next.lastMessage = prev.lastMessage;
      return { conversations: { ...s.conversations, [conv._id]: next } };
    }),

  patchConversation: (conversationId, fn) =>
    set((s) => {
      const conv = s.conversations[conversationId];
      if (!conv) return {};
      return { conversations: { ...s.conversations, [conversationId]: fn(conv) } };
    }),

  removeConversation: (conversationId) =>
    set((s) => {
      const conversations = { ...s.conversations };
      const threads = { ...s.threads };
      delete conversations[conversationId];
      delete threads[conversationId];
      return { conversations, threads, activeId: s.activeId === conversationId ? null : s.activeId };
    }),

  openDirect: async (userId) => {
    const res = await api.post("/conversations/direct", { userId });
    get().upsertConversation(res.data.conversation);
    return res.data.conversation;
  },

  /** "Saved Messages" (notes to self). */
  openSelf: async () => {
    const res = await api.get("/conversations/self");
    get().upsertConversation(res.data.conversation);
    return res.data.conversation;
  },

  toggleFavorite: (conv) => get().updateMySettings(conv._id, { favorite: !conv.me.favorite }),

  exportChat: async (conv) => {
    const res = await api.get(`/conversations/${conv._id}/export`, { responseType: "blob", timeout: 120000 });
    const title = conversationTitle(conv).replace(/[^\w\- ]+/g, "").trim() || "chat";
    saveBlob(res.data, `BlinkChat - ${title}.txt`);
  },

  pinMessage: async (conversationId, messageId) => {
    const res = await api.post(`/conversations/${conversationId}/pins`, { messageId });
    get().upsertConversation(res.data.conversation);
  },

  unpinMessage: async (conversationId, messageId) => {
    const res = await api.delete(`/conversations/${conversationId}/pins/${messageId}`);
    get().upsertConversation(res.data.conversation);
  },

  createInvite: async (conversationId) => {
    const res = await api.post(`/conversations/${conversationId}/invite`);
    get().patchConversation(conversationId, (c) => ({ ...c, inviteCode: res.data.inviteCode }));
    return res.data.inviteCode;
  },

  revokeInvite: async (conversationId) => {
    await api.delete(`/conversations/${conversationId}/invite`);
    get().patchConversation(conversationId, (c) => ({ ...c, inviteCode: null }));
  },

  createGroup: async ({ name, memberIds, avatar = "", description = "" }) => {
    const res = await api.post("/conversations/group", { name, memberIds, avatar, description });
    get().upsertConversation(res.data.conversation);
    return res.data.conversation;
  },

  updateGroup: async (conversationId, patch) => {
    const res = await api.patch(`/conversations/${conversationId}`, patch);
    get().upsertConversation(res.data.conversation);
  },

  addMembers: async (conversationId, userIds) => {
    const res = await api.post(`/conversations/${conversationId}/members`, { userIds });
    get().upsertConversation(res.data.conversation);
  },

  removeMember: async (conversationId, userId) => {
    await api.delete(`/conversations/${conversationId}/members/${userId}`);
    if (userId === meId()) get().removeConversation(conversationId);
  },

  setMemberRole: async (conversationId, userId, role) => {
    const res = await api.patch(`/conversations/${conversationId}/members/${userId}`, { role });
    get().upsertConversation(res.data.conversation);
  },

  setDisappearing: async (conversationId, seconds) => {
    const res = await api.put(`/conversations/${conversationId}/disappearing`, { seconds });
    get().upsertConversation(res.data.conversation);
  },

  updateMySettings: async (conversationId, patch) => {
    const res = await api.patch(`/conversations/${conversationId}/settings`, patch);
    get().patchConversation(conversationId, (c) => ({ ...c, me: { ...c.me, ...res.data.me } }));
  },

  clearChat: async (conversationId) => {
    const res = await api.post(`/conversations/${conversationId}/clear`);
    get()._applyCleared(conversationId, res.data.clearedAt);
  },

  deleteChat: async (conversationId) => {
    await api.delete(`/conversations/${conversationId}`);
    get().removeConversation(conversationId);
  },

  toggleBlock: async (userId) => {
    const res = await api.put(`/users/${userId}/block`);
    useAuthStore.getState().setUser({ blockedUsers: res.data.blockedUsers });
    set((s) => {
      const conversations = { ...s.conversations };
      for (const [id, c] of Object.entries(conversations)) {
        if (c.type === "direct" && c.peerId === userId) conversations[id] = { ...c, blocked: res.data.blocked };
      }
      return { conversations };
    });
    return res.data.blocked;
  },

  // ---- Active conversation & messages ------------------------------------

  openConversation: (conversationId) => {
    const s = get();
    const conv = s.conversations[conversationId];
    const anchors = { ...s.anchors };
    if (conv?.me.unreadCount > 0) anchors[conversationId] = { since: conv.me.lastReadAt, count: conv.me.unreadCount };
    else delete anchors[conversationId];
    set({ activeId: conversationId, anchors });

    const thread = s.threads[conversationId];
    if (!thread?.loaded) get().loadLatest(conversationId);
    else if (!thread.hasNewer) get().refreshLatest(conversationId);
    get().markRead(conversationId);
  },

  closeConversation: () => set({ activeId: null }),

  _setThread: (conversationId, fn) =>
    set((s) => ({ threads: { ...s.threads, [conversationId]: fn(s.threads[conversationId] || emptyThread()) } })),

  loadLatest: async (conversationId) => {
    get()._setThread(conversationId, (t) => ({ ...t, loading: true, error: null }));
    try {
      const res = await api.get(`/conversations/${conversationId}/messages`, { params: { limit: PAGE } });
      const queued = get().outbox.filter((o) => o.conversationId === conversationId).map((o) => o.temp);
      // Keep anything that arrived over the socket while this request was
      // in flight (it may be newer than the page we got back).
      get()._setThread(conversationId, (t) => ({
        ...emptyThread(),
        items: mergeMessages(res.data.messages, [...t.items, ...queued]),
        hasMore: res.data.hasMore,
        loaded: true,
      }));
    } catch (err) {
      get()._setThread(conversationId, (t) => ({ ...t, loading: false, error: errorMessage(err, "Couldn't load messages") }));
    }
  },

  /** After reconnecting / reopening: merge the newest page without losing scrollback. */
  refreshLatest: async (conversationId) => {
    try {
      const res = await api.get(`/conversations/${conversationId}/messages`, { params: { limit: PAGE } });
      get()._setThread(conversationId, (t) => {
        const newestServer = res.data.messages[0];
        const lastKnown = t.items.filter((m) => !m.status).at(-1);
        // Gap between what we have and the newest page: start fresh.
        const gap = newestServer && lastKnown && time(newestServer) > time(lastKnown) && res.data.hasMore;
        const base = gap ? t.items.filter((m) => m.status) : t.items;
        return { ...t, items: mergeMessages(base, res.data.messages), hasMore: gap ? res.data.hasMore : t.hasMore, loaded: true };
      });
    } catch {
      // keep what we have
    }
  },

  loadOlder: async (conversationId) => {
    const thread = get().threads[conversationId];
    if (!thread || thread.loadingOlder || !thread.hasMore) return;
    const oldest = thread.items.find((m) => !m.status);
    if (!oldest) return;
    get()._setThread(conversationId, (t) => ({ ...t, loadingOlder: true }));
    try {
      const res = await api.get(`/conversations/${conversationId}/messages`, { params: { before: oldest._id, limit: PAGE } });
      get()._setThread(conversationId, (t) => ({
        ...t,
        items: mergeMessages(t.items, res.data.messages),
        hasMore: res.data.hasMore,
        loadingOlder: false,
      }));
    } catch {
      get()._setThread(conversationId, (t) => ({ ...t, loadingOlder: false }));
    }
  },

  loadNewer: async (conversationId) => {
    const thread = get().threads[conversationId];
    if (!thread || thread.loadingNewer || !thread.hasNewer) return;
    const newest = [...thread.items].reverse().find((m) => !m.status);
    if (!newest) return;
    get()._setThread(conversationId, (t) => ({ ...t, loadingNewer: true }));
    try {
      const res = await api.get(`/conversations/${conversationId}/messages`, { params: { after: newest._id, limit: PAGE } });
      get()._setThread(conversationId, (t) => ({
        ...t,
        items: mergeMessages(t.items, res.data.messages),
        hasNewer: res.data.hasNewer,
        loadingNewer: false,
      }));
    } catch {
      get()._setThread(conversationId, (t) => ({ ...t, loadingNewer: false }));
    }
  },

  /** Scroll to a message, loading the page around it if necessary. */
  jumpToMessage: async (conversationId, messageId) => {
    const thread = get().threads[conversationId];
    if (!thread?.items.some((m) => m._id === messageId)) {
      try {
        const res = await api.get(`/conversations/${conversationId}/messages`, { params: { around: messageId, limit: PAGE } });
        get()._setThread(conversationId, (t) => ({
          ...t,
          items: res.data.messages,
          hasMore: res.data.hasMore,
          hasNewer: res.data.hasNewer,
          loaded: true,
          loading: false,
        }));
      } catch {
        toast.error("That message isn't available anymore");
        return;
      }
    }
    set({ jump: { conversationId, messageId, nonce: Date.now() } });
  },

  jumpToLatest: async (conversationId) => {
    const thread = get().threads[conversationId];
    if (thread?.hasNewer) await get().loadLatest(conversationId);
    set({ jump: { conversationId, messageId: "__latest__", nonce: Date.now() } });
  },

  markRead: (conversationId) => {
    const conv = get().conversations[conversationId];
    if (!conv) return;
    const last = conv.lastMessage;
    const stale = last && last.sender !== meId() && new Date(last.createdAt) > new Date(conv.me.lastReadAt || 0);
    if (!conv.me.unreadCount && !conv.me.mentionCount && !stale) return;
    const at = new Date().toISOString();
    get().patchConversation(conversationId, (c) => ({ ...c, me: { ...c.me, unreadCount: 0, mentionCount: 0, lastReadAt: at } }));
    api.post(`/conversations/${conversationId}/read`).catch(() => {});
  },

  setReplyTo: (conversationId, message) =>
    set((s) => ({ replyTo: { ...s.replyTo, [conversationId]: message }, editing: { ...s.editing, [conversationId]: null } })),

  setEditing: (conversationId, message) =>
    set((s) => ({ editing: { ...s.editing, [conversationId]: message }, replyTo: { ...s.replyTo, [conversationId]: null } })),

  // ---- Sending ------------------------------------------------------------

  /**
   * Optimistic send. `files` are prepared attachments from the composer:
   * { file, kind, previewUrl, width, height, duration, voice, waveform }.
   * The bubble shows immediately with local previews and upload progress.
   */
  sendMessage: async (
    conversationId,
    { text = "", files = [], attachments = [], replyTo = null, urgent = false, poll = null, location = null, contact = null, mentions = [], viewOnce = false }
  ) => {
    const cid = clientId();
    const temp = {
      _id: cid,
      clientId: cid,
      conversation: conversationId,
      sender: meId(),
      type: "user",
      text,
      poll: poll ? { question: poll.question, multiple: Boolean(poll.multiple), closedAt: null, options: poll.options.map((t, i) => ({ id: String(i + 1), text: t, voters: [] })) } : null,
      location: location || null,
      contactCard: contact ? { user: contact._id, name: contact.fullName, avatar: contact.profilePic || "" } : null,
      mentions,
      viewOnce: Boolean(viewOnce),
      attachments: [
        ...attachments.map((a) => ({ ...a, sig: undefined })),
        ...files.map((f) => ({
        kind: f.kind,
        url: f.previewUrl,
        previewUrl: f.previewUrl,
        name: f.file.name,
        mime: f.file.type,
        size: f.file.size,
        width: f.width ?? null,
        height: f.height ?? null,
        duration: f.duration ?? null,
        voice: Boolean(f.voice),
        waveform: f.waveform,
        local: true,
        progress: 0,
      })),
      ],
      replyTo: replySnapshot(replyTo),
      reactions: [],
      forwarded: false,
      urgent,
      createdAt: new Date().toISOString(),
      status: "pending",
      fresh: true,
    };
    const entry = {
      conversationId,
      temp,
      files,
      uploaded: [],
      payload: {
        text,
        replyTo: replyTo?._id || null,
        urgent,
        clientId: cid,
        // Ready-made attachments (GIFs/stickers); uploads are appended on send.
        attachments,
        ...(poll ? { poll: { question: poll.question, options: poll.options, multiple: Boolean(poll.multiple) } } : {}),
        ...(location ? { location } : {}),
        ...(contact ? { contactUserId: contact._id } : {}),
        ...(mentions.length ? { mentions } : {}),
        ...(viewOnce ? { viewOnce: true } : {}),
      },
    };
    pendingEntries.set(cid, entry);

    get()._appendLocal(conversationId, temp);
    set((s) => ({ anchors: { ...s.anchors, [conversationId]: undefined } }));
    await get()._deliver(entry);
  },

  _setUploadProgress: (conversationId, cid, index, progress) =>
    get()._setThread(conversationId, (t) => ({
      ...t,
      items: t.items.map((m) =>
        m.clientId === cid && m.status
          ? { ...m, attachments: m.attachments.map((a, i) => (i === index ? { ...a, progress } : a)) }
          : m
      ),
    })),

  _appendLocal: (conversationId, msg) => {
    get()._setThread(conversationId, (t) => ({ ...t, items: mergeMessages(t.items, [msg]) }));
    get().patchConversation(conversationId, (c) => ({ ...c, lastMessage: msg, lastMessageAt: msg.createdAt }));
  },

  _deliver: async (entry) => {
    const { conversationId, payload, temp, files = [] } = entry;
    try {
      // Upload anything not uploaded yet (retries skip finished files).
      entry.uploaded ||= [];
      for (let i = entry.uploaded.length; i < files.length; i += 1) {
        const f = files[i];
        let last = 0;
        const attachment = await uploadFile(f.file, {
          meta: { width: f.width, height: f.height, duration: f.duration, voice: f.voice || undefined, waveform: f.waveform },
          onProgress: (p) => {
            if (p - last < 0.08 && p < 1) return; // throttle re-renders
            last = p;
            get()._setUploadProgress(conversationId, temp.clientId, i, p);
          },
        });
        entry.uploaded.push(attachment);
      }
      const res = await api.post(`/conversations/${conversationId}/messages`, { ...payload, attachments: [...(payload.attachments || []), ...entry.uploaded] });
      get()._dropFromOutbox(temp.clientId);
      pendingEntries.delete(temp.clientId);
      // Keep local previews so images don't flash while the CDN copy loads.
      const message = {
        ...res.data.message,
        fresh: true,
        attachments: res.data.message.attachments.map((a, i) => ({ ...a, previewUrl: temp.attachments[i]?.previewUrl })),
        // The sender keeps seeing their own view-once photo locally.
        viewOnceMedia: temp.viewOnce ? temp.attachments.map((a) => ({ ...a })) : undefined,
      };
      get()._receive(message, { fromSelf: true });
    } catch (err) {
      const offline = !err.response;
      if (offline && !files.length) {
        // Network problem: keep it pending and retry automatically later.
        get()._queue(entry);
      } else {
        get()._dropFromOutbox(temp.clientId);
        get()._markFailed(conversationId, temp.clientId, errorMessage(err, "Message not sent"));
        if (!offline) toast.error(errorMessage(err, "Message not sent"));
      }
    }
  },

  _queue: (entry) => {
    if (get().outbox.some((o) => o.temp.clientId === entry.temp.clientId)) return;
    const outbox = [...get().outbox, { ...entry, temp: { ...entry.temp, queued: true } }];
    set({ outbox });
    storage.set(OUTBOX_KEY, outbox);
  },

  _dropFromOutbox: (cid) => {
    if (!get().outbox.some((o) => o.temp.clientId === cid)) return;
    const outbox = get().outbox.filter((o) => o.temp.clientId !== cid);
    set({ outbox });
    storage.set(OUTBOX_KEY, outbox);
  },

  flushOutbox: async () => {
    if (get().flushing) return;
    set({ flushing: true });
    try {
      for (const entry of [...get().outbox]) {
        const { conversationId, payload } = entry;
        try {
          const res = await api.post(`/conversations/${conversationId}/messages`, payload);
          get()._dropFromOutbox(payload.clientId);
          get()._receive(res.data.message, { fromSelf: true });
        } catch (err) {
          if (!err.response) break; // still offline
          get()._dropFromOutbox(payload.clientId);
          get()._markFailed(conversationId, payload.clientId, errorMessage(err, "Message not sent"));
        }
      }
    } finally {
      set({ flushing: false });
    }
  },

  _markFailed: (conversationId, cid, error) =>
    get()._setThread(conversationId, (t) => ({
      ...t,
      items: t.items.map((m) => (m.clientId === cid && m.status ? { ...m, status: "failed", error } : m)),
    })),

  retryMessage: async (conversationId, cid) => {
    const msg = get().threads[conversationId]?.items.find((m) => m.clientId === cid && m.status === "failed");
    if (!msg) return;
    get()._setThread(conversationId, (t) => ({
      ...t,
      items: t.items.map((m) => (m === msg ? { ...m, status: "pending", error: null } : m)),
    }));
    const entry = pendingEntries.get(cid) || {
      conversationId,
      temp: msg,
      files: [],
      uploaded: [],
      payload: { text: msg.text, replyTo: msg.replyTo?.message || null, urgent: msg.urgent, clientId: cid, attachments: [] },
    };
    await get()._deliver(entry);
  },

  discardMessage: (conversationId, cid) => {
    pendingEntries.delete(cid);
    get()._dropFromOutbox(cid);
    get()._setThread(conversationId, (t) => ({ ...t, items: t.items.filter((m) => !(m.clientId === cid && m.status)) }));
  },

  editMessage: async (conversationId, messageId, text) => {
    const res = await api.patch(`/messages/${messageId}`, { text });
    get()._receive(res.data.message);
  },

  deleteMessage: async (conversationId, messageId, scope) => {
    if (scope === "me") {
      await api.delete(`/messages/${messageId}`, { params: { scope: "me" } });
      get()._hide(conversationId, messageId);
    } else {
      const res = await api.delete(`/messages/${messageId}`, { params: { scope: "everyone" } });
      get()._receive(res.data.message);
    }
  },

  react: async (conversationId, messageId, emoji) => {
    const me = meId();
    // Optimistic toggle; the server's broadcast settles the final state.
    get()._setThread(conversationId, (t) => ({
      ...t,
      items: t.items.map((m) => {
        if (m._id !== messageId) return m;
        const mine = m.reactions.find((r) => r.user === me);
        const rest = m.reactions.filter((r) => r.user !== me);
        return { ...m, reactions: mine?.emoji === emoji ? rest : [...rest, { user: me, emoji }] };
      }),
    }));
    try {
      const res = await api.post(`/messages/${messageId}/react`, { emoji });
      get()._receive(res.data.message);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't react"));
    }
  },

  forward: async (messageId, conversationIds) => {
    const res = await api.post(`/messages/${messageId}/forward`, { conversationIds });
    res.data.messages.forEach((m) => get()._receive(m, { fromSelf: true }));
    return res.data.messages;
  },

  // ---- Realtime handlers ----------------------------------------------------

  /** Applies a message from the server (HTTP response or socket event). */
  _receive: (message, { fromSelf = false } = {}) => {
    const s = get();
    const conversationId = message.conversation;
    const conv = s.conversations[conversationId];
    if (!conv) {
      get().fetchConversation(conversationId);
      return;
    }
    const thread = s.threads[conversationId];
    if (thread && !thread.hasNewer) {
      // Loaded, or still loading (merged with the page when it arrives).
      get()._setThread(conversationId, (t) => ({ ...t, items: mergeMessages(t.items, [message]) }));
    } else if (thread) {
      // Viewing older history: only refresh copies we already show.
      get()._setThread(conversationId, (t) => ({ ...t, items: t.items.map((m) => (m._id === message._id ? message : m)) }));
    }
    const replacesLast =
      conv.lastMessage && (conv.lastMessage._id === message._id || (message.clientId && conv.lastMessage.clientId === message.clientId));
    if (replacesLast || isNewer(message, conv.lastMessage)) {
      get().patchConversation(conversationId, (c) => ({
        ...c,
        lastMessage: message,
        lastMessageAt: replacesLast && !fromSelf ? c.lastMessageAt : message.createdAt,
      }));
    }
    return message;
  },

  onMessageNew: (message) => {
    const me = meId();
    const isMine = message.sender === me;
    const existed = get().threads[message.conversation]?.items.some((m) => m._id === message._id || (message.clientId && m.clientId === message.clientId));
    get()._receive({ ...message, fresh: !isMine && !existed });
    if (isMine || existed) return { notify: false };

    const s = get();
    const conversationId = message.conversation;
    if (viewing(s, conversationId)) {
      get().markRead(conversationId);
      return { notify: false, conversation: s.conversations[conversationId] };
    }
    if (countsAsUnread(message)) {
      const mentioned = message.mentions?.includes(me);
      get().patchConversation(conversationId, (c) => ({
        ...c,
        me: { ...c.me, unreadCount: (c.me.unreadCount || 0) + 1, mentionCount: (c.me.mentionCount || 0) + (mentioned ? 1 : 0) },
      }));
    }
    const conv = get().conversations[conversationId];
    return { notify: message.type !== "system" && countsAsUnread(message), conversation: conv, muted: isMuted(conv) };
  },

  onMessageUpdated: (message) => get()._receive(message),

  _patchMessage: (conversationId, messageId, fn) =>
    get()._setThread(conversationId, (t) => ({ ...t, items: t.items.map((m) => (m._id === messageId ? fn(m) : m)) })),

  onStarred: ({ conversationId, messageId, starred }) => get()._patchMessage(conversationId, messageId, (m) => ({ ...m, starred })),

  star: async (message, starred) => {
    get().onStarred({ conversationId: message.conversation, messageId: message._id, starred });
    try {
      await api.put(`/messages/${message._id}/star`, { starred });
      toast.success(starred ? "Starred" : "Removed from starred", { id: `star-${message._id}` });
    } catch (err) {
      get().onStarred({ conversationId: message.conversation, messageId: message._id, starred: !starred });
      toast.error(errorMessage(err));
    }
  },

  vote: async (message, optionIds) => {
    const me = meId();
    const ids = message.poll.multiple ? optionIds : optionIds.slice(0, 1);
    get()._patchMessage(message.conversation, message._id, (m) => ({
      ...m,
      poll: {
        ...m.poll,
        options: m.poll.options.map((o) => ({ ...o, voters: [...o.voters.filter((v) => v !== me), ...(ids.includes(o.id) ? [me] : [])] })),
      },
    }));
    try {
      const res = await api.post(`/messages/${message._id}/poll/vote`, { optionIds: ids });
      get()._receive(res.data.message);
    } catch (err) {
      get()._receive(message);
      toast.error(errorMessage(err, "Couldn't vote"));
    }
  },

  closePoll: async (message) => {
    const res = await api.post(`/messages/${message._id}/poll/close`);
    get()._receive(res.data.message);
  },

  /** Fetches view-once media (works exactly once per message). */
  openViewOnce: async (message) => {
    const res = await api.post(`/messages/${message._id}/view-once`);
    get()._patchMessage(message.conversation, message._id, (m) => ({ ...m, viewOnceOpened: true, viewedBy: [...new Set([...(m.viewedBy || []), meId()])] }));
    return res.data.attachments;
  },

  _hide: (conversationId, messageId) => {
    get()._setThread(conversationId, (t) => ({ ...t, items: t.items.filter((m) => m._id !== messageId) }));
    const conv = get().conversations[conversationId];
    if (conv?.lastMessage?._id === messageId) {
      const items = get().threads[conversationId]?.items || [];
      get().patchConversation(conversationId, (c) => ({ ...c, lastMessage: items.at(-1) || null }));
    }
  },

  _applyCleared: (conversationId, at) => {
    get()._setThread(conversationId, (t) => ({
      ...t,
      items: t.items.filter((m) => new Date(m.createdAt) > new Date(at)),
      hasMore: false,
    }));
    get().patchConversation(conversationId, (c) => ({
      ...c,
      lastMessage: null,
      me: { ...c.me, clearedAt: at, unreadCount: 0, mentionCount: 0, lastReadAt: at },
    }));
  },

  onConversationRead: ({ conversationId, userId, at, self }) => {
    if (self || userId === meId()) {
      get().patchConversation(conversationId, (c) => ({ ...c, me: { ...c.me, unreadCount: 0, mentionCount: 0, lastReadAt: at } }));
      return;
    }
    get().patchConversation(conversationId, (c) => ({
      ...c,
      members: c.members.map((m) =>
        m.user._id === userId ? { ...m, lastReadAt: at, lastDeliveredAt: maxDate(m.lastDeliveredAt, at) } : m
      ),
    }));
  },

  onConversationDelivered: ({ conversationId, userIds, at }) =>
    get().patchConversation(conversationId, (c) => ({
      ...c,
      members: c.members.map((m) => (userIds.includes(m.user._id) ? { ...m, lastDeliveredAt: maxDate(m.lastDeliveredAt, at) } : m)),
    })),

  onTyping: ({ conversationId, userId, isTyping, recording }) =>
    set((s) => {
      const current = { ...(s.typing[conversationId] || {}) };
      if (isTyping) current[userId] = { at: Date.now(), recording };
      else delete current[userId];
      return { typing: { ...s.typing, [conversationId]: current } };
    }),

  pruneTyping: () =>
    set((s) => {
      const now = Date.now();
      let changed = false;
      const typing = {};
      for (const [cid, users] of Object.entries(s.typing)) {
        const kept = Object.fromEntries(Object.entries(users).filter(([, v]) => now - v.at < TYPING_TTL));
        if (Object.keys(kept).length !== Object.keys(users).length) changed = true;
        typing[cid] = kept;
      }
      return changed ? { typing } : {};
    }),

  /** Contact profile changed (name, photo, status, privacy...). */
  onUserUpdated: (user) =>
    set((s) => {
      const conversations = { ...s.conversations };
      for (const [id, c] of Object.entries(conversations)) {
        if (c.members.some((m) => m.user._id === user._id)) {
          conversations[id] = { ...c, members: c.members.map((m) => (m.user._id === user._id ? { ...m, user: { ...m.user, ...user } } : m)) };
        }
      }
      return { conversations };
    }),

  onUserDeleted: (userId) =>
    get().onUserUpdated({ _id: userId, fullName: "Deleted account", profilePic: "", about: "", deleted: true, presenceVisible: false, lastSeen: null }),

  /** Remove messages whose disappearing timer ran out. */
  pruneExpired: () => {
    const now = Date.now();
    for (const [cid, t] of Object.entries(get().threads)) {
      if (t.items.some((m) => m.expiresAt && new Date(m.expiresAt).getTime() <= now)) {
        get()._setThread(cid, (th) => ({ ...th, items: th.items.filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now) }));
      }
    }
  },

  resync: async () => {
    await get().fetchConversations();
    const active = get().activeId;
    if (active && get().conversations[active]) {
      await get().refreshLatest(active);
      get().markRead(active);
    } else if (active) {
      set({ activeId: null });
    }
  },

  // ---- AI translations ------------------------------------------------------

  translate: async (messageIds, lang) => {
    const ids = messageIds.filter((id) => !get().translations[id]?.text && !get().translations[id]?.loading);
    if (!ids.length) return;
    set((s) => ({ translations: { ...s.translations, ...Object.fromEntries(ids.map((id) => [id, { loading: true }])) } }));
    try {
      const res = await api.post("/ai/translate", { messageIds: ids, lang });
      set((s) => {
        const next = { ...s.translations };
        for (const id of ids) next[id] = res.data.translations[id] || { same: true };
        return { translations: next };
      });
    } catch (err) {
      set((s) => ({ translations: { ...s.translations, ...Object.fromEntries(ids.map((id) => [id, { error: true }])) } }));
      toast.error(errorMessage(err, "Translation failed"));
    }
  },

  hideTranslation: (messageId) =>
    set((s) => {
      const next = { ...s.translations };
      delete next[messageId];
      return { translations: next };
    }),

  // ---- Scheduled messages -----------------------------------------------------

  fetchScheduled: async (conversationId) => {
    try {
      const res = await api.get(`/conversations/${conversationId}/scheduled`);
      set((s) => ({ scheduled: { ...s.scheduled, [conversationId]: res.data.scheduled } }));
    } catch {
      // non-critical
    }
  },

  schedule: async (conversationId, { text, attachments = [], replyTo = null, urgent = false, sendAt }) => {
    await api.post(`/conversations/${conversationId}/scheduled`, {
      text,
      attachments,
      replyTo: replyTo?._id || null,
      urgent,
      sendAt: sendAt.toISOString(),
    });
    await get().fetchScheduled(conversationId);
  },

  cancelScheduled: async (conversationId, id) => {
    await api.delete(`/scheduled/${id}`);
    set((s) => ({ scheduled: { ...s.scheduled, [conversationId]: (s.scheduled[conversationId] || []).filter((x) => x._id !== id) } }));
  },

  sendScheduledNow: async (conversationId, id) => {
    await api.patch(`/scheduled/${id}`, { sendNow: true });
    set((s) => ({ scheduled: { ...s.scheduled, [conversationId]: (s.scheduled[conversationId] || []).filter((x) => x._id !== id) } }));
  },

  reset: () => {
    storage.remove(OUTBOX_KEY);
    set({
      conversations: {},
      loaded: false,
      loadError: null,
      activeId: null,
      threads: {},
      typing: {},
      replyTo: {},
      editing: {},
      anchors: {},
      jump: null,
      translations: {},
      scheduled: {},
      outbox: [],
      flushing: false,
    });
  },
}));

function maxDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/** Unread messages in chats that aren't muted or archived (badges, title). */
export const selectTotalUnread = (s) =>
  Object.values(s.conversations).reduce((sum, c) => (c.me.archived || isMuted(c) ? sum : sum + (c.me.unreadCount || 0)), 0);

export { isMuted };
