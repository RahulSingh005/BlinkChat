import { idStr, isActiveUntil, sameId, truncate } from "./utils.js";

// Fields needed to build any public/self user shape.
export const USER_PUBLIC_FIELDS =
  "_id fullName profilePic about phone timezone lastSeen settings status focus blockedUsers createdAt";

const activeStatus = (status) => {
  if (!status || (!status.text && !status.emoji)) return null;
  if (status.expiresAt && !isActiveUntil(status.expiresAt)) return null;
  return { emoji: status.emoji || "", text: status.text || "", expiresAt: status.expiresAt || null };
};

export const hasBlocked = (user, otherId) => Boolean(user?.blockedUsers?.some((id) => sameId(id, otherId)));

/**
 * What `viewer` is allowed to see about `user`. Respects the user's privacy
 * settings and blocks: people you've blocked can't see your photo, about,
 * presence, local time or status.
 */
export function publicUser(user, viewer = null) {
  if (!user) return null;
  const viewerId = viewer?._id;
  const isSelf = viewerId && sameId(user._id, viewerId);
  const blockedViewer = !isSelf && viewerId ? hasBlocked(user, viewerId) : false;
  const viewerHidesPresence = !isSelf && viewer?.settings?.showLastSeen === false;
  const showPresence = isSelf || (user.settings?.showLastSeen !== false && !blockedViewer && !viewerHidesPresence);
  const shareTime = user.settings?.shareLocalTime !== false && !blockedViewer;

  return {
    _id: idStr(user._id),
    fullName: user.fullName,
    profilePic: blockedViewer ? "" : user.profilePic || "",
    about: blockedViewer ? "" : user.about || "",
    phone: blockedViewer ? "" : user.phone || "",
    timezone: shareTime ? user.timezone || null : null,
    lastSeen: showPresence ? user.lastSeen || null : null,
    presenceVisible: showPresence,
    status: blockedViewer ? null : activeStatus(user.status),
    focusUntil: !blockedViewer && isActiveUntil(user.focus?.until) ? user.focus.until : null,
    allowUrgent: user.focus?.allowUrgent !== false,
    createdAt: user.createdAt,
  };
}

export const deletedUser = (id) => ({
  _id: idStr(id),
  fullName: "Deleted account",
  profilePic: "",
  about: "",
  phone: "",
  timezone: null,
  lastSeen: null,
  presenceVisible: false,
  status: null,
  focusUntil: null,
  allowUrgent: false,
  deleted: true,
});

/** The signed-in user's own profile. */
export function selfUser(user) {
  return {
    _id: idStr(user._id),
    fullName: user.fullName,
    email: user.email,
    profilePic: user.profilePic || "",
    about: user.about || "",
    phone: user.phone || "",
    timezone: user.timezone || "UTC",
    authProvider: user.authProvider,
    hasPassword: user.hasPassword !== false,
    lastSeen: user.lastSeen,
    blockedUsers: (user.blockedUsers || []).map(idStr),
    settings: {
      showLastSeen: user.settings?.showLastSeen !== false,
      readReceipts: user.settings?.readReceipts !== false,
      shareLocalTime: user.settings?.shareLocalTime !== false,
      notificationPreviews: user.settings?.notificationPreviews !== false,
      language: user.settings?.language || "en",
    },
    status: activeStatus(user.status),
    focus: {
      until: isActiveUntil(user.focus?.until) ? user.focus.until : null,
      allowUrgent: user.focus?.allowUrgent !== false,
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function serializeMessage(msg) {
  if (!msg) return null;
  const m = typeof msg.toObject === "function" ? msg.toObject() : msg;
  const deleted = Boolean(m.deletedAt);
  return {
    _id: idStr(m._id),
    conversation: idStr(m.conversation),
    sender: idStr(m.sender),
    type: m.type || "user",
    text: deleted ? "" : m.text || "",
    attachments: deleted ? [] : (m.attachments || []).map((a) => ({
      kind: a.kind,
      url: a.url,
      name: a.name || "",
      mime: a.mime || "",
      size: a.size || 0,
      width: a.width ?? null,
      height: a.height ?? null,
      duration: a.duration ?? null,
      voice: Boolean(a.voice),
      waveform: a.waveform?.length ? a.waveform : undefined,
    })),
    replyTo:
      deleted || !m.replyTo?.message
        ? null
        : {
            message: idStr(m.replyTo.message),
            sender: idStr(m.replyTo.sender),
            text: m.replyTo.text || "",
            kind: m.replyTo.kind || null,
          },
    forwarded: Boolean(m.forwarded),
    urgent: Boolean(m.urgent),
    scheduled: Boolean(m.scheduled),
    reactions: deleted ? [] : (m.reactions || []).map((r) => ({ user: idStr(r.user), emoji: r.emoji })),
    editedAt: m.editedAt || null,
    deletedAt: m.deletedAt || null,
    clientId: m.clientId || null,
    system: m.system
      ? { event: m.system.event, targets: (m.system.targets || []).map(idStr), data: m.system.data ?? null }
      : null,
    call: m.call ? { kind: m.call.kind, status: m.call.status, duration: m.call.duration || 0 } : null,
    transcript: deleted ? undefined : m.transcript || undefined,
    expiresAt: m.expiresAt || null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

const KIND_LABEL = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎵 Audio",
  file: "📎 File",
};

/** Short human preview used for notifications and reminders. */
export function messagePreview(msg) {
  if (!msg) return "";
  if (msg.deletedAt) return "This message was deleted";
  if (msg.type === "call" && msg.call) {
    const kind = msg.call.kind === "video" ? "video" : "voice";
    if (msg.call.status === "completed") return `📞 ${kind === "video" ? "Video" : "Voice"} call`;
    return `📞 Missed ${kind} call`;
  }
  const first = msg.attachments?.[0];
  if (first) {
    const label =
      first.kind === "audio" && first.voice
        ? "🎤 Voice message"
        : first.kind === "file"
          ? `📎 ${first.name || "File"}`
          : KIND_LABEL[first.kind] || "Attachment";
    return msg.text ? `${label} · ${truncate(msg.text, 90)}` : label;
  }
  return truncate(msg.text || "", 120);
}

/**
 * Shapes a conversation for `viewer`. `usersById` must contain the member
 * users (selected with USER_PUBLIC_FIELDS). Read receipts are only exposed
 * when both sides have them enabled.
 */
export function serializeConversation(conv, viewer, usersById, lastMessage = undefined) {
  const c = typeof conv.toObject === "function" ? conv.toObject() : conv;
  const viewerId = viewer._id;
  const viewerReceipts = viewer.settings?.readReceipts !== false;
  const meMember = c.members.find((m) => sameId(m.user, viewerId));

  const members = c.members.map((m) => {
    const u = usersById.get(idStr(m.user));
    const isMe = sameId(m.user, viewerId);
    const theirReceipts = u?.settings?.readReceipts !== false;
    return {
      user: u ? publicUser(u, viewer) : deletedUser(m.user),
      role: m.role,
      joinedAt: m.joinedAt,
      lastReadAt: isMe || (viewerReceipts && theirReceipts) ? m.lastReadAt : null,
      lastDeliveredAt: m.lastDeliveredAt,
    };
  });

  const out = {
    _id: idStr(c._id),
    type: c.type,
    name: c.name || "",
    description: c.description || "",
    avatar: c.avatar || "",
    createdBy: idStr(c.createdBy),
    createdAt: c.createdAt,
    lastMessageAt: c.lastMessageAt,
    disappearingSeconds: c.disappearingSeconds || 0,
    members,
    me: {
      role: meMember?.role || "member",
      joinedAt: meMember?.joinedAt || null,
      unreadCount: meMember?.unreadCount || 0,
      lastReadAt: meMember?.lastReadAt || null,
      mutedUntil: isActiveUntil(meMember?.mutedUntil) ? meMember.mutedUntil : null,
      pinnedAt: meMember?.pinnedAt || null,
      archived: Boolean(meMember?.archived),
      clearedAt: meMember?.clearedAt || null,
    },
  };

  if (c.type === "direct") {
    const peer = c.members.find((m) => !sameId(m.user, viewerId));
    out.peerId = peer ? idStr(peer.user) : null;
    out.blocked = peer ? hasBlocked(viewer, peer.user) : false;
  }

  if (lastMessage !== undefined) out.lastMessage = lastMessage ? serializeMessage(lastMessage) : null;
  return out;
}
