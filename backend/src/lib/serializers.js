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

/**
 * Message shape for clients. Pass `viewerId` to include per-viewer fields
 * (starred, view-once opened); broadcasts omit them and clients keep their
 * own copy. View-once media URLs are never included — they're fetched once
 * through /messages/:id/view-once.
 */
export function serializeMessage(msg, viewerId = null) {
  if (!msg) return null;
  const m = typeof msg.toObject === "function" ? msg.toObject() : msg;
  const deleted = Boolean(m.deletedAt);
  const viewOnce = Boolean(m.viewOnce);
  const out = {
    _id: idStr(m._id),
    conversation: idStr(m.conversation),
    sender: idStr(m.sender),
    type: m.type || "user",
    text: deleted ? "" : m.text || "",
    attachments: deleted
      ? []
      : (m.attachments || []).map((a) => ({
          kind: a.kind,
          url: viewOnce ? null : a.url,
          mp4: viewOnce ? undefined : a.mp4 || undefined,
          provider: a.provider || undefined,
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
    poll:
      deleted || !m.poll
        ? null
        : {
            question: m.poll.question,
            multiple: Boolean(m.poll.multiple),
            closedAt: m.poll.closedAt || null,
            options: m.poll.options.map((o) => ({ id: o.id, text: o.text, voters: (o.voters || []).map(idStr) })),
          },
    location: deleted || !m.location ? null : { lat: m.location.lat, lng: m.location.lng, accuracy: m.location.accuracy ?? null, label: m.location.label || "" },
    contactCard: deleted || !m.contactCard ? null : { user: idStr(m.contactCard.user), name: m.contactCard.name || "", avatar: m.contactCard.avatar || "" },
    linkPreview: deleted || !m.linkPreview?.url ? null : { ...m.linkPreview },
    mentions: (m.mentions || []).map(idStr),
    viewOnce,
    viewedBy: viewOnce ? (m.viewedBy || []).map(idStr) : undefined,
    storyReply: deleted || !m.storyReply?.story ? null : { ...m.storyReply, story: idStr(m.storyReply.story), owner: idStr(m.storyReply.owner) },
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
  if (viewerId) {
    out.starred = (m.starredBy || []).some((id) => sameId(id, viewerId));
    if (viewOnce) out.viewOnceOpened = (m.viewedBy || []).some((id) => sameId(id, viewerId));
  }
  return out;
}

const KIND_LABEL = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎵 Audio",
  file: "📎 File",
  gif: "GIF",
  sticker: "Sticker",
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
  if (msg.poll) return `📊 Poll: ${truncate(msg.poll.question, 90)}`;
  if (msg.location) return msg.location.label ? `📍 ${truncate(msg.location.label, 80)}` : "📍 Location";
  if (msg.contactCard) return `👤 Contact: ${msg.contactCard.name || "Contact"}`;
  const first = msg.attachments?.[0];
  if (first) {
    if (msg.viewOnce) return first.kind === "video" ? "🎥 View once video" : "📷 View once photo";
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
export function serializeConversation(conv, viewer, usersById, lastMessage = undefined, pinnedMessages = undefined) {
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
      mentionCount: meMember?.mentionCount || 0,
      favorite: Boolean(meMember?.favorite),
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

  if (c.type === "group" && meMember?.role === "admin") out.inviteCode = c.inviteCode || null;
  if (pinnedMessages !== undefined) {
    const byId = new Map(pinnedMessages.map((p) => [idStr(p._id), p]));
    out.pinned = (c.pinned || [])
      .map((p) => {
        const msg = byId.get(idStr(p.message));
        if (!msg || msg.deletedAt || msg.hiddenFor?.some((id) => sameId(id, viewerId))) return null;
        return { message: serializeMessage(msg, viewerId), by: idStr(p.by), at: p.at };
      })
      .filter(Boolean);
  }
  if (lastMessage !== undefined) out.lastMessage = lastMessage ? serializeMessage(lastMessage, viewerId) : null;
  return out;
}
