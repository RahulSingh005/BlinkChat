import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import Reminder from "../models/reminder.model.js";
import User from "../models/user.model.js";
import { badRequest, forbidden, gone } from "../lib/errors.js";
import { emitToUser } from "../lib/realtime.js";
import { messagePreview, serializeMessage } from "../lib/serializers.js";
import { deleteStoredFile } from "../lib/storage.js";
import { escapeRegex, idStr, sameId, toObjectId } from "../lib/utils.js";
import { getConversationForMember, getMember, isAdmin, visibleSince } from "../services/conversation.service.js";
import {
  EDIT_WINDOW_MS,
  assertCanSend,
  broadcastMessageUpdate,
  createMessage,
  attachLinkPreview,
  getMessageForMember,
} from "../services/message.service.js";
import { firstUrl } from "../lib/unfurl.js";
import { serializeReminder } from "./reminder.controller.js";

const MAX_PENDING_REMINDERS = 100;

export const editMessage = async (req, res) => {
  const { message, conv } = await getMessageForMember(req.params.id, req.user._id);
  if (!sameId(message.sender, req.user._id) || message.type !== "user") throw forbidden("You can only edit your own messages");
  if (message.deletedAt) throw badRequest("This message was deleted");
  if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) throw badRequest("Messages can only be edited within 24 hours");
  if (message.forwarded) throw badRequest("Forwarded messages can't be edited");
  if (message.poll || message.location || message.contactCard || message.viewOnce) throw badRequest("This message can't be edited");

  const text = req.data.text;
  if (text === message.text) return res.json({ message: serializeMessage(message, req.user._id) });

  const linkChanged = firstUrl(text) !== firstUrl(message.text);
  message.text = text;
  message.editedAt = new Date();
  message.translations = undefined;
  if (linkChanged) message.linkPreview = null;
  await message.save();
  broadcastMessageUpdate(conv, message);
  if (linkChanged && !message.attachments.length) attachLinkPreview(conv, message.toObject()).catch(() => {});
  res.json({ message: serializeMessage(message, req.user._id) });
};

/** scope=me hides it on my devices; scope=everyone tombstones it for all. */
export const deleteMessage = async (req, res) => {
  const scope = req.query.scope === "everyone" ? "everyone" : "me";
  const { message, conv } = await getMessageForMember(req.params.id, req.user._id);

  if (scope === "me") {
    await Message.updateOne({ _id: message._id }, { $addToSet: { hiddenFor: toObjectId(req.user._id) } });
    emitToUser(req.user._id, "message:hidden", { messageId: idStr(message._id), conversationId: idStr(conv._id) });
    return res.json({ hidden: true });
  }

  const own = sameId(message.sender, req.user._id);
  const moderator = conv.type === "group" && isAdmin(conv, req.user._id);
  if (message.type !== "user" || !(own || moderator)) throw forbidden("You can only delete your own messages for everyone");
  if (message.deletedAt) return res.json({ message: serializeMessage(message) });

  message.attachments.forEach((a) => deleteStoredFile(a));
  message.deletedAt = new Date();
  message.text = "";
  message.attachments = [];
  message.reactions = [];
  message.replyTo = null;
  message.transcript = undefined;
  message.translations = undefined;
  message.poll = null;
  message.location = null;
  message.contactCard = null;
  message.linkPreview = null;
  message.storyReply = null;
  await message.save();
  // Deleted messages can't stay pinned.
  if (conv.pinned?.some((p) => sameId(p.message, message._id))) {
    await Conversation.updateOne({ _id: conv._id }, { $pull: { pinned: { message: message._id } } });
  }
  broadcastMessageUpdate(conv, message);
  res.json({ message: serializeMessage(message) });
};

/** One reaction per person (WhatsApp-style); same emoji again removes it. */
export const reactToMessage = async (req, res) => {
  const { message, conv } = await getMessageForMember(req.params.id, req.user._id);
  if (message.deletedAt || message.type !== "user") throw badRequest("You can't react to this message");

  const me = toObjectId(req.user._id);
  const current = message.reactions.find((r) => sameId(r.user, me));
  await Message.updateOne({ _id: message._id }, { $pull: { reactions: { user: me } } });
  if (current?.emoji !== req.data.emoji) {
    await Message.updateOne({ _id: message._id }, { $push: { reactions: { user: me, emoji: req.data.emoji, at: new Date() } } });
  }

  const fresh = await Message.findById(message._id);
  broadcastMessageUpdate(conv, fresh);
  res.json({ message: serializeMessage(fresh, req.user._id) });
};

export const forwardMessage = async (req, res) => {
  const { message } = await getMessageForMember(req.params.id, req.user._id);
  if (message.deletedAt || message.type !== "user") throw badRequest("This message can't be forwarded");

  if (message.viewOnce) throw badRequest("View once media can't be forwarded");
  const results = [];
  for (const conversationId of [...new Set(req.data.conversationIds)]) {
    const target = await getConversationForMember(conversationId, req.user._id);
    await assertCanSend(target, req.user._id);
    const { message: copy } = await createMessage({
      conversation: target,
      senderId: req.user._id,
      text: message.text,
      attachments: message.attachments.map((a) => (typeof a.toObject === "function" ? a.toObject() : a)),
      location: message.location ? { ...(message.location.toObject?.() || message.location) } : null,
      contactCard: message.contactCard ? { ...(message.contactCard.toObject?.() || message.contactCard) } : null,
      // A forwarded poll starts over with no votes.
      poll: message.poll
        ? {
            question: message.poll.question,
            multiple: message.poll.multiple,
            options: message.poll.options.map((o) => ({ id: o.id, text: o.text, voters: [] })),
          }
        : null,
      forwarded: true,
    });
    results.push(serializeMessage(copy, req.user._id));
  }
  res.status(201).json({ messages: results });
};

export const remindMe = async (req, res) => {
  const { message, conv } = await getMessageForMember(req.params.id, req.user._id);
  const { remindAt, note } = req.data;
  const ms = remindAt.getTime() - Date.now();
  if (ms < 30 * 1000) throw badRequest("Pick a time at least a minute from now");
  if (ms > 365 * 24 * 60 * 60 * 1000) throw badRequest("Reminders can be set up to a year ahead");

  const pending = await Reminder.countDocuments({ user: req.user._id, status: "pending" });
  if (pending >= MAX_PENDING_REMINDERS) throw badRequest("You have too many pending reminders");

  const sender = await User.findById(message.sender).select("fullName").lean();
  const reminder = await Reminder.create({
    user: req.user._id,
    conversation: conv._id,
    message: message._id,
    remindAt,
    note,
    preview: { text: messagePreview(message), senderName: sender?.fullName || "Deleted account" },
  });
  emitToUser(req.user._id, "reminders:changed", {});
  res.status(201).json({ reminder: serializeReminder(reminder.toObject()) });
};

// ---- Polls -------------------------------------------------------------------

/** Replaces my vote(s). Sending an empty list retracts my vote. */
export const votePoll = async (req, res) => {
  const { message, conv } = await getMessageForMember(req.params.id, req.user._id);
  if (!message.poll || message.deletedAt) throw badRequest("This poll is no longer available");
  if (message.poll.closedAt) throw badRequest("This poll has ended");
  await assertCanSend(conv, req.user._id);

  const valid = new Set(message.poll.options.map((o) => o.id));
  let choice = [...new Set(req.data.optionIds)].filter((id) => valid.has(id));
  if (!message.poll.multiple) choice = choice.slice(0, 1);

  const me = toObjectId(req.user._id);
  await Message.updateOne({ _id: message._id }, { $pull: { "poll.options.$[].voters": me } });
  if (choice.length) {
    await Message.updateOne(
      { _id: message._id, "poll.closedAt": null },
      { $addToSet: { "poll.options.$[o].voters": me } },
      { arrayFilters: [{ "o.id": { $in: choice } }] }
    );
  }
  const fresh = await Message.findById(message._id).lean();
  broadcastMessageUpdate(conv, fresh);
  res.json({ message: serializeMessage(fresh, req.user._id) });
};

export const closePoll = async (req, res) => {
  const { message, conv } = await getMessageForMember(req.params.id, req.user._id);
  if (!message.poll || message.deletedAt) throw badRequest("This poll is no longer available");
  if (!sameId(message.sender, req.user._id)) throw forbidden("Only the person who created the poll can end it");
  if (!message.poll.closedAt) {
    message.poll.closedAt = new Date();
    await message.save();
    broadcastMessageUpdate(conv, message);
  }
  res.json({ message: serializeMessage(message, req.user._id) });
};

// ---- Starred messages ----------------------------------------------------------

export const starMessage = async (req, res) => {
  const { message } = await getMessageForMember(req.params.id, req.user._id);
  if (message.type !== "user" || message.deletedAt) throw badRequest("This message can't be starred");
  const me = toObjectId(req.user._id);
  const { starred } = req.data;
  await Message.updateOne({ _id: message._id }, starred ? { $addToSet: { starredBy: me } } : { $pull: { starredBy: me } });
  // Sync my other devices.
  emitToUser(req.user._id, "message:starred", {
    messageId: idStr(message._id),
    conversationId: idStr(message.conversation),
    starred,
  });
  res.json({ starred });
};

/** Clauses limiting a query to messages I can still see in each chat. */
async function visibleClauses(userId, extra = {}) {
  const convs = await Conversation.find({ "members.user": userId, ...extra }).select("type members").lean();
  return {
    convs,
    clauses: convs.map((c) => ({ conversation: c._id, createdAt: { $gt: visibleSince(c, getMember(c, userId)) } })),
  };
}

export const listStarred = async (req, res) => {
  const me = toObjectId(req.user._id);
  const { before, limit } = req.data;
  const { clauses } = await visibleClauses(req.user._id);
  if (!clauses.length) return res.json({ messages: [], hasMore: false });

  const and = [{ $or: clauses }];
  if (before) and.push({ createdAt: { $lt: before } });
  const page = await Message.find({ starredBy: me, deletedAt: null, hiddenFor: { $ne: me }, $and: and })
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();
  res.json({ messages: page.slice(0, limit).map((m) => serializeMessage(m, me)), hasMore: page.length > limit });
};

/** Search across every chat I'm in (newest first). */
export const searchAllMessages = async (req, res) => {
  const me = toObjectId(req.user._id);
  const { q, limit } = req.data;
  const { clauses } = await visibleClauses(req.user._id);
  if (!clauses.length) return res.json({ messages: [] });

  const regex = new RegExp(escapeRegex(q), "i");
  const results = await Message.find({
    type: "user",
    deletedAt: null,
    viewOnce: { $ne: true },
    hiddenFor: { $ne: me },
    $and: [{ $or: clauses }, { $or: [{ text: regex }, { "attachments.name": regex }, { "poll.question": regex }] }],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .maxTimeMS(5000)
    .lean();
  res.json({ messages: results.map((m) => serializeMessage(m, me)) });
};

// ---- View once -------------------------------------------------------------------

/** Hands out the media of a view-once message exactly once per recipient. */
export const openViewOnce = async (req, res) => {
  const { message, conv } = await getMessageForMember(req.params.id, req.user._id);
  if (!message.viewOnce || message.deletedAt) throw badRequest("This media isn't available");
  if (sameId(message.sender, req.user._id)) throw forbidden("You can't open view once media you sent");

  const me = toObjectId(req.user._id);
  const claimed = await Message.findOneAndUpdate(
    { _id: message._id, viewedBy: { $ne: me } },
    { $addToSet: { viewedBy: me } },
    { new: true }
  ).lean();
  if (!claimed) throw gone("You already opened this");
  broadcastMessageUpdate(conv, claimed);
  res.set("Cache-Control", "no-store");
  res.json({
    attachments: claimed.attachments.map((a) => ({
      kind: a.kind,
      url: a.url,
      mime: a.mime || "",
      width: a.width ?? null,
      height: a.height ?? null,
      duration: a.duration ?? null,
    })),
  });
};
