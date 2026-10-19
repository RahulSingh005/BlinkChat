import toast from "react-hot-toast";
import MessageToast from "../components/ui/MessageToast";
import { clearAllDrafts } from "../lib/drafts";
import { firstName } from "../lib/format";
import { navigateTo } from "../lib/navigation";
import { previewText } from "../lib/preview";
import { sounds } from "../lib/sound";
import { storage } from "../lib/storage";
import { PUSH_OWNER_KEY, useAuthStore } from "./useAuthStore";
import { useCallLogStore } from "./useCallLogStore";
import { useCallStore } from "./useCallStore";
import { conversationTitle, useChatStore } from "./useChatStore";
import { useLockStore } from "./useLockStore";
import { useReminderStore } from "./useReminderStore";
import { useSettingsStore } from "./useSettingsStore";
import { useStoryStore } from "./useStoryStore";

/** Clears every per-account store (logout / account switch). */
export function resetSessionStores() {
  useCallStore.getState().reset();
  useChatStore.getState().reset();
  useReminderStore.getState().reset();
  useStoryStore.getState().reset();
  useCallLogStore.getState().reset();
  clearAllDrafts();
  toast.remove();
}

async function systemNotification({ title, body, icon, tag, url }) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, icon: icon || "/icons/icon-192.png", badge: "/icons/badge-72.png", tag, renotify: true, data: { url } });
      return;
    }
    const n = new Notification(title, { body, icon: icon || "/icons/icon-192.png", tag });
    n.onclick = () => {
      window.focus();
      navigateTo(url);
      n.close();
    };
  } catch {
    // notifications are best-effort
  }
}

function notifyMessage(message, conversation) {
  const me = useAuthStore.getState().authUser;
  if (!me || !conversation) return;
  const focusing = me.focus?.until && new Date(me.focus.until) > new Date();
  const muted = conversation.me?.mutedUntil && new Date(conversation.me.mutedUntil) > new Date();
  const urgentOk = message.urgent && me.focus?.allowUrgent !== false;
  // @mentions get through a muted group (not focus mode), like WhatsApp.
  const mentioned = message.mentions?.includes(me._id);
  if (focusing && !urgentOk) return;
  if (muted && !urgentOk && !mentioned) return;
  const locked = useLockStore.getState().locked;

  const settings = useSettingsStore.getState();
  const sender = conversation.members.find((m) => m.user._id === message.sender)?.user;
  const isGroup = conversation.type === "group";
  const title = conversationTitle(conversation, me._id);
  const preview = previewText(message, { conv: conversation, meId: me._id });
  const body = isGroup ? `${firstName(sender?.fullName)}: ${preview}` : preview;
  const url = `/chat/${conversation._id}`;

  if (settings.sounds) sounds.message();

  if (document.visibilityState === "visible") {
    // Never preview messages over the lock screen.
    if (locked) return;
    toast.custom(
      (t) => (
        <MessageToast
          t={t}
          title={title}
          body={body}
          urgent={message.urgent}
          avatar={{ src: isGroup ? conversation.avatar : sender?.profilePic, name: title, seed: isGroup ? conversation._id : sender?._id, group: isGroup }}
          onOpen={() => navigateTo(url)}
        />
      ),
      { id: `msg-${conversation._id}`, duration: 4500, position: "top-center" }
    );
    return;
  }
  // Tab hidden: Web Push (if enabled for this device) is sent by the server;
  // otherwise fall back to a local system notification.
  const pushOnThisDevice = storage.get(PUSH_OWNER_KEY) === me._id;
  if (!pushOnThisDevice && settings.desktopNotifications) {
    systemNotification({
      title: message.urgent ? `Urgent · ${title}` : title,
      body: me.settings?.notificationPreviews === false || locked ? "New message" : body,
      icon: isGroup ? conversation.avatar : sender?.profilePic,
      tag: `conv-${conversation._id}`,
      url,
    });
  }
}

/** Wires every server event to the stores. Called once per socket. */
export function bindRealtime(socket) {
  const auth = useAuthStore;
  const chat = useChatStore;
  const calls = useCallStore;
  const reminders = useReminderStore;
  let connectedBefore = false;

  socket.on("connect", () => {
    auth.setState({ connection: "connected" });
    socket.emit("visibility", { visible: document.visibilityState === "visible" });
    if (connectedBefore) calls.getState().rejoin();
    chat.getState().resync();
    reminders.getState().fetch();
    useStoryStore.getState().fetch();
    useCallLogStore.getState().fetch();
    chat.getState().flushOutbox();
    connectedBefore = true;
  });

  socket.on("disconnect", (reason) => {
    auth.setState({ connection: reason === "io client disconnect" ? "idle" : "reconnecting" });
  });

  socket.on("connect_error", async (err) => {
    if (err?.message === "unauthorized") {
      // Session revoked or expired: confirm with the API, then sign out.
      await auth.getState().checkAuth();
      if (auth.getState().status !== "authenticated") auth.getState()._clearSession();
      return;
    }
    auth.setState({ connection: "reconnecting" });
  });

  // Presence
  socket.on("presence:init", ({ online }) => {
    const presence = { ...auth.getState().presence };
    for (const id of Object.keys(presence)) presence[id] = { ...presence[id], online: false };
    for (const id of online) presence[id] = { ...presence[id], online: true };
    auth.setState({ presence });
  });
  socket.on("presence", ({ userId, online, lastSeen }) => {
    auth.getState().setPresence(userId, { online, ...(lastSeen ? { lastSeen } : {}) });
  });

  // Messages & conversations
  socket.on("message:new", ({ message }) => {
    const result = chat.getState().onMessageNew(message);
    if (result?.notify) notifyMessage(message, result.conversation);
    if (message.type === "call") useCallLogStore.getState().refetchSoon();
  });
  socket.on("message:starred", (payload) => chat.getState().onStarred(payload));
  socket.on("message:updated", ({ message }) => chat.getState().onMessageUpdated(message));
  socket.on("message:hidden", ({ conversationId, messageId }) => chat.getState()._hide(conversationId, messageId));
  socket.on("conversation:new", ({ conversation }) => chat.getState().upsertConversation(conversation));
  socket.on("conversation:updated", ({ conversation }) => chat.getState().upsertConversation(conversation));
  socket.on("conversation:me", ({ conversationId, me }) =>
    chat.getState().patchConversation(conversationId, (c) => ({ ...c, me: { ...c.me, ...me } }))
  );
  socket.on("conversation:removed", ({ conversationId }) => {
    const wasActive = chat.getState().activeId === conversationId;
    chat.getState().removeConversation(conversationId);
    if (wasActive) navigateTo("/chat", { replace: true });
  });
  socket.on("conversation:read", (payload) => chat.getState().onConversationRead(payload));
  socket.on("conversation:delivered", (payload) => chat.getState().onConversationDelivered(payload));
  socket.on("conversation:cleared", ({ conversationId, at }) => chat.getState()._applyCleared(conversationId, at));
  socket.on("typing", (payload) => chat.getState().onTyping(payload));

  // People
  socket.on("user:updated", ({ user }) => {
    chat.getState().onUserUpdated(user);
    if (!user.presenceVisible) auth.getState().setPresence(user._id, { online: false });
  });
  socket.on("user:deleted", ({ userId }) => chat.getState().onUserDeleted(userId));
  socket.on("me:updated", ({ user }) => auth.setState({ authUser: user }));
  socket.on("me:blocks", ({ blockedUsers }) => auth.getState().setUser({ blockedUsers }));

  // Status updates
  socket.on("story:new", () => useStoryStore.getState().refetchSoon());
  socket.on("story:deleted", ({ storyId }) => useStoryStore.getState()._dropStory(storyId));
  socket.on("story:viewed", (payload) => {
    useStoryStore.getState().onViewed(payload);
    if (payload.reaction && !useLockStore.getState().locked) {
      toast(`${firstName(payload.reaction.name)} reacted ${payload.reaction.emoji} to your status`, { id: `story-r-${payload.storyId}` });
    }
  });

  // Scheduled messages & reminders
  socket.on("scheduled:changed", ({ conversationId }) => chat.getState().fetchScheduled(conversationId));
  socket.on("scheduled:sent", ({ conversationId }) => chat.getState().fetchScheduled(conversationId));
  socket.on("scheduled:failed", ({ conversationId, error }) => {
    chat.getState().fetchScheduled(conversationId);
    toast.error(`A scheduled message couldn't be sent: ${error}`);
  });
  socket.on("reminders:changed", () => reminders.getState().fetch());
  socket.on("reminder:due", ({ reminder }) => {
    reminders.getState().onDue(reminder);
    if (useSettingsStore.getState().sounds) sounds.reminder();
    toast.custom(
      (t) => (
        <MessageToast
          t={t}
          title={`Reminder${reminder.preview?.senderName ? ` · ${reminder.preview.senderName}` : ""}`}
          body={reminder.note || reminder.preview?.text || "You asked to be reminded about a message"}
          icon="reminder"
          onOpen={() => navigateTo(`/chat/${reminder.conversation}?message=${reminder.message}`)}
        />
      ),
      { id: `rem-${reminder._id}`, duration: 10000, position: "top-center" }
    );
  });

  // Calls
  socket.on("call:incoming", (payload) => calls.getState().onIncoming(payload));
  socket.on("call:accepted", (payload) => calls.getState().onAccepted(payload));
  socket.on("call:signal", (payload) => calls.getState().onSignal(payload));
  socket.on("call:media", (payload) => calls.getState().onRemoteMedia(payload));
  socket.on("call:taken", (payload) => calls.getState().onTaken(payload));
  socket.on("call:declined", (payload) => calls.getState().onDeclined(payload));
  socket.on("call:ended", (payload) => calls.getState().onEnded(payload));

  // Sessions
  socket.on("session:revoked", ({ exceptSocketId }) => {
    if (exceptSocketId && exceptSocketId === socket.id) return;
    auth.getState()._clearSession();
    toast("You were signed out of this device.");
  });
}
