import toast from "react-hot-toast";
import { Archive, ArchiveRestore, Ban, Bell, BellOff, CheckCheck, LogOut, Pin, PinOff, ShieldCheck, Trash2, Eraser } from "lucide-react";
import { errorMessage } from "../../lib/api";
import { firstName } from "../../lib/format";
import { conversationTitle, isMuted, peerOf, useChatStore } from "../../store/useChatStore";
import { useUIStore } from "../../store/useUIStore";

const run = async (fn, ok) => {
  try {
    await fn();
    if (ok) toast.success(ok);
  } catch (err) {
    toast.error(errorMessage(err));
  }
};

const MUTE_OPTIONS = [
  { label: "Mute for 8 hours", seconds: 8 * 3600 },
  { label: "Mute for 1 week", seconds: 7 * 24 * 3600 },
  { label: "Mute always", seconds: -1 },
];

export function muteItems(conv) {
  const chat = useChatStore.getState();
  if (isMuted(conv)) {
    return [{ key: "unmute", label: "Unmute notifications", icon: Bell, onSelect: () => run(() => chat.updateMySettings(conv._id, { muteFor: null }), "Notifications on") }];
  }
  return MUTE_OPTIONS.map((o) => ({
    key: `mute-${o.seconds}`,
    label: o.label,
    icon: BellOff,
    onSelect: () => run(() => chat.updateMySettings(conv._id, { muteFor: o.seconds }), "Muted"),
  }));
}

export async function confirmClear(conv) {
  const ok = await useUIStore.getState().ask({
    title: "Clear this chat?",
    body: "Messages will be removed from this chat on your devices only. The other side keeps their copy.",
    confirmLabel: "Clear chat",
    danger: true,
  });
  if (ok) run(() => useChatStore.getState().clearChat(conv._id), "Chat cleared");
}

export async function confirmDelete(conv, onDone) {
  const group = conv.type === "group";
  const ok = await useUIStore.getState().ask({
    title: group ? `Exit “${conv.name}”?` : "Delete this chat?",
    body: group
      ? "You'll stop receiving messages from this group. Admins can add you again."
      : "The chat disappears from your list and its history is cleared for you. It comes back if a new message arrives.",
    confirmLabel: group ? "Exit group" : "Delete chat",
    danger: true,
  });
  if (!ok) return;
  await run(() => useChatStore.getState().deleteChat(conv._id), group ? "You left the group" : "Chat deleted");
  onDone?.();
}

export async function confirmBlock(conv) {
  const peer = peerOf(conv);
  if (!peer) return;
  const blocking = !conv.blocked;
  const ok = await useUIStore.getState().ask({
    title: blocking ? `Block ${firstName(peer.fullName)}?` : `Unblock ${firstName(peer.fullName)}?`,
    body: blocking
      ? "Blocked contacts can't message or call you, and won't see your photo, status or when you're online."
      : "They'll be able to message and call you again.",
    confirmLabel: blocking ? "Block" : "Unblock",
    danger: blocking,
  });
  if (ok) run(() => useChatStore.getState().toggleBlock(peer._id), blocking ? "Blocked" : "Unblocked");
}

/** Context menu for a conversation row. */
export function listMenuItems(conv, { onDeleted } = {}) {
  const chat = useChatStore.getState();
  const pinned = Boolean(conv.me.pinnedAt);
  return [
    {
      key: "pin",
      label: pinned ? "Unpin chat" : "Pin to top",
      icon: pinned ? PinOff : Pin,
      onSelect: () => run(() => chat.updateMySettings(conv._id, { pinned: !pinned })),
    },
    conv.me.unreadCount > 0 && { key: "read", label: "Mark as read", icon: CheckCheck, onSelect: () => chat.markRead(conv._id) },
    {
      key: "archive",
      label: conv.me.archived ? "Unarchive" : "Archive",
      icon: conv.me.archived ? ArchiveRestore : Archive,
      onSelect: () => run(() => chat.updateMySettings(conv._id, { archived: !conv.me.archived }), conv.me.archived ? "Moved to chats" : "Archived"),
    },
    "divider",
    ...muteItems(conv),
    "divider",
    { key: "clear", label: "Clear chat", icon: Eraser, onSelect: () => confirmClear(conv) },
    conv.type === "direct" && {
      key: "block",
      label: conv.blocked ? "Unblock" : "Block",
      icon: conv.blocked ? ShieldCheck : Ban,
      danger: !conv.blocked,
      onSelect: () => confirmBlock(conv),
    },
    {
      key: "delete",
      label: conv.type === "group" ? "Exit group" : "Delete chat",
      icon: conv.type === "group" ? LogOut : Trash2,
      danger: true,
      onSelect: () => confirmDelete(conv, onDeleted),
    },
  ];
}

export { conversationTitle };
