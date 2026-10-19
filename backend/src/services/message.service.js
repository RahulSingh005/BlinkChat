import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { badRequest, forbidden, gone, notFound } from "../lib/errors.js";
import { emitToUser, emitToUsers, hasVisibleSocket, isOnline } from "../lib/realtime.js";
import { env } from "../config/env.js";
import { invalidateContacts, isBlockedEitherWay } from "../lib/cache.js";
import { sendPushToUser } from "../lib/push.js";
import { messagePreview, serializeMessage } from "../lib/serializers.js";
import { isTrustedMediaUrl } from "../lib/storage.js";
import { verifyMediaSignature } from "../lib/klipy.js";
import { firstUrl, unfurl } from "../lib/unfurl.js";
import { idStr, isActiveUntil, sameId, toObjectId, truncate } from "../lib/utils.js";

export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const URGENT_PER_HOUR = 3;

/** Throws unless `senderId` may post in this conversation right now. */
export async function assertCanSend(conv, senderId) {
  if (conv.type !== "direct") return; // groups and "Saved Messages"
  const peer = conv.members.find((m) => !sameId(m.user, senderId));
  if (!peer) throw gone("This chat is no longer available");
  const peerExists = await User.exists({ _id: peer.user });
  if (!peerExists) throw gone("This account no longer exists");
  if (await isBlockedEitherWay(senderId, peer.user)) {
    throw forbidden("You can't send messages in this chat. Unblock the contact first, or they may have restricted messages.");
  }
}

export function validateAttachments(attachments = []) {
  for (const att of attachments) {
    if (att.kind === "gif" || att.kind === "sticker") {
      if (!verifyMediaSignature(att)) throw badRequest("That GIF couldn't be verified. Pick it again from the GIF panel.");
    } else if (!isTrustedMediaUrl(att.url)) {
      throw badRequest("Attachment must be uploaded through BlinkChat first");
    }
  }
  return attachments.map((a) => ({
    kind: a.kind,
    url: a.url,
    mp4: a.kind === "gif" ? a.mp4 || "" : "",
    provider: a.kind === "gif" || a.kind === "sticker" ? a.provider || "klipy" : "",
    name: truncate(a.name || "", 200),
    mime: a.mime || "",
    size: a.size || 0,
    width: a.width ?? null,
    height: a.height ?? null,
    duration: a.duration ?? null,
    voice: Boolean(a.voice) && a.kind === "audio",
    waveform: a.kind === "audio" && a.waveform?.length ? a.waveform.slice(0, 64) : undefined,
    publicId: a.publicId || "",
    storage: a.storage || "local",
  }));
}

async function buildReplySnapshot(conversationId, replyToId) {
  if (!replyToId) return null;
  const original = await Message.findOne({ _id: replyToId, conversation: conversationId }).lean();
  if (!original || original.deletedAt) return null;
  return {
    message: original._id,
    sender: original.sender,
    text: truncate(original.text || "", 200),
    kind: original.attachments?.[0]?.kind || (original.type === "call" ? "call" : null),
  };
}

async function urgentAllowed(conv, senderId) {
  if (conv.type !== "direct") return false;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await Message.countDocuments({
    conversation: conv._id,
    sender: senderId,
    urgent: true,
    createdAt: { $gte: since },
  });
  return count < URGENT_PER_HOUR;
}

/**
 * Creates a message and fans it out: unread counters, delivery receipts for
 * online recipients, realtime events to every member's devices and Web Push
 * for people who aren't looking at the app.
 *
 * Idempotent per (sender, clientId): retries return the original message.
 */
export async function createMessage({
  conversation: conv,
  senderId,
  text = "",
  attachments = [],
  replyTo = null,
  forwarded = false,
  urgent = false,
  clientId,
  type = "user",
  system = null,
  call = null,
  scheduled = false,
  poll = null,
  location = null,
  contactCard = null,
  mentions = [],
  viewOnce = false,
  storyReply = null,
  countsAsUnread = type === "user",
  notify = type === "user",
}) {
  if (clientId) {
    const existing = await Message.findOne({ sender: senderId, clientId }).lean();
    if (existing) return { message: existing, duplicate: true };
  }

  const doc = {
    conversation: conv._id,
    sender: senderId,
    type,
    text: type === "user" ? text.trim() : text,
    attachments,
    replyTo: type === "user" ? await buildReplySnapshot(conv._id, replyTo) : null,
    forwarded,
    urgent: urgent && type === "user" ? await urgentAllowed(conv, senderId) : false,
    scheduled,
    clientId: clientId || undefined,
    system,
    call,
    poll,
    location,
    contactCard,
    // Only people actually in this group can be mentioned.
    mentions: conv.type === "group" ? uniqueMentionIds(conv, mentions, senderId) : [],
    viewOnce: Boolean(viewOnce) && attachments.some((a) => a.kind === "image" || a.kind === "video"),
    storyReply,
  };
  if (conv.disappearingSeconds > 0 && type !== "system") {
    doc.expiresAt = new Date(Date.now() + conv.disappearingSeconds * 1000);
  }

  let message;
  try {
    message = (await Message.create(doc)).toObject();
  } catch (err) {
    if (err?.code === 11000 && clientId) {
      const existing = await Message.findOne({ sender: senderId, clientId }).lean();
      if (existing) return { message: existing, duplicate: true };
    }
    throw err;
  }

  const at = message.createdAt;
  const senderObjId = toObjectId(senderId);
  const memberIds = conv.members.map((m) => idStr(m.user));
  const recipients = memberIds.filter((id) => id !== idStr(senderId));
  const onlineRecipients = recipients.filter(isOnline);

  const $set = {
    lastMessageAt: at,
    "members.$[s].lastReadAt": at,
    "members.$[s].hidden": false,
    "members.$[r].hidden": false,
  };
  const arrayFilters = [{ "s.user": senderObjId }, { "r.user": { $ne: senderObjId } }];
  if (onlineRecipients.length) {
    $set["members.$[d].lastDeliveredAt"] = at;
    arrayFilters.push({ "d.user": { $in: onlineRecipients.map(toObjectId) } });
  }
  const update = { $set };
  if (countsAsUnread) update.$inc = { "members.$[r].unreadCount": 1 };
  if (countsAsUnread && doc.mentions.length) {
    update.$inc["members.$[m].mentionCount"] = 1;
    arrayFilters.push({ "m.user": { $in: doc.mentions } });
  }
  await Conversation.updateOne({ _id: conv._id }, update, { arrayFilters });

  const payload = { message: serializeMessage(message) };
  emitToUsers(memberIds, "message:new", payload);
  if (onlineRecipients.length) {
    emitToUser(senderId, "conversation:delivered", {
      conversationId: idStr(conv._id),
      userIds: onlineRecipients,
      at,
    });
  }

  if (notify && recipients.length) {
    notifyRecipients(conv, message, recipients).catch((err) => console.warn("[push] notify failed:", err.message));
  }
  // First message in a 1:1 chat makes the two people "contacts" (stories).
  if (conv.type === "direct" && !conv.lastMessageAt) invalidateContacts(memberIds);
  if (env.LINK_PREVIEWS && type === "user" && !attachments.length && !poll && !location && !contactCard) {
    attachLinkPreview(conv, message).catch(() => {});
  }

  return { message, duplicate: false };
}

function uniqueMentionIds(conv, mentions, senderId) {
  const memberSet = new Set(conv.members.map((m) => idStr(m.user)));
  return [...new Set((mentions || []).map(idStr))]
    .filter((id) => memberSet.has(id) && id !== idStr(senderId))
    .slice(0, 50)
    .map(toObjectId);
}

/** Unfurls the first link in the background and updates the message. */
export async function attachLinkPreview(conv, message) {
  if (!env.LINK_PREVIEWS) return;
  const url = firstUrl(message.text);
  if (!url) return;
  const preview = await unfurl(url);
  if (!preview) return;
  const updated = await Message.findOneAndUpdate(
    { _id: message._id, deletedAt: null },
    { $set: { linkPreview: preview } },
    { new: true }
  ).lean();
  if (updated) broadcastMessageUpdate(conv, updated);
}

/** Web Push for recipients without a visible tab, honoring mute/focus. */
async function notifyRecipients(conv, message, recipientIds) {
  const targets = recipientIds.filter((id) => !hasVisibleSocket(id));
  if (!targets.length) return;

  const [sender, users] = await Promise.all([
    User.findById(message.sender).select("fullName profilePic").lean(),
    User.find({ _id: { $in: targets } }).select("settings focus blockedUsers").lean(),
  ]);
  const senderName = sender?.fullName || "Someone";
  const preview = messagePreview(message);

  await Promise.all(
    users.map(async (user) => {
      const member = conv.members.find((m) => sameId(m.user, user._id));
      const muted = isActiveUntil(member?.mutedUntil);
      const focusing = isActiveUntil(user.focus?.until);
      const urgentOk = message.urgent && user.focus?.allowUrgent !== false;
      // @mentions notify even in a muted group (like WhatsApp), but focus
      // mode still holds them unless the message is urgent.
      const mentioned = (message.mentions || []).some((id) => sameId(id, user._id));
      if (focusing && !urgentOk) return;
      if (muted && !urgentOk && !mentioned) return;

      const showPreview = user.settings?.notificationPreviews !== false;
      const isGroup = conv.type === "group";
      const title = isGroup ? conv.name || "Group" : senderName;
      const body = showPreview ? (isGroup ? `${senderName.split(" ")[0]}: ${preview}` : preview) : "New message";

      await sendPushToUser(
        user._id,
        {
          type: "message",
          title: message.urgent ? `🚨 ${title}` : title,
          body: truncate(body, 180),
          icon: (isGroup ? conv.avatar : sender?.profilePic) || undefined,
          tag: `conv-${idStr(conv._id)}`,
          url: `/chat/${idStr(conv._id)}`,
          conversationId: idStr(conv._id),
          urgent: Boolean(message.urgent),
        },
        { topic: idStr(conv._id), urgency: message.urgent ? "high" : "normal" }
      );
    })
  );
}

/** Loads a message the viewer can see, along with its conversation. */
export async function getMessageForMember(messageId, userId) {
  const message = await Message.findById(messageId);
  if (!message || message.hiddenFor?.some((id) => sameId(id, userId))) throw notFound("Message not found");
  const conv = await Conversation.findOne({ _id: message.conversation, "members.user": userId });
  if (!conv) throw notFound("Message not found");
  return { message, conv };
}

export function broadcastMessageUpdate(conv, message) {
  emitToUsers(
    conv.members.map((m) => m.user),
    "message:updated",
    { message: serializeMessage(message) }
  );
}

/**
 * Creates a system notice like "Alice added Bob". Names are stored on the
 * message because removed members no longer appear in the member list.
 */
export async function postSystemMessage(conv, actorId, event, { targets = [], data = null } = {}) {
  const people = await User.find({ _id: { $in: [actorId, ...targets] } }).select("fullName").lean();
  const names = Object.fromEntries(people.map((u) => [idStr(u._id), u.fullName]));
  const { message } = await createMessage({
    conversation: conv,
    senderId: actorId,
    type: "system",
    system: { event, targets, data: { ...(data || {}), names } },
    countsAsUnread: false,
    notify: false,
  });
  return message;
}
