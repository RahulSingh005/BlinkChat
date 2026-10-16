import Message from "../models/message.model.js";
import Reminder from "../models/reminder.model.js";
import User from "../models/user.model.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { emitToUser } from "../lib/realtime.js";
import { messagePreview, serializeMessage } from "../lib/serializers.js";
import { deleteStoredFile } from "../lib/storage.js";
import { idStr, sameId, toObjectId } from "../lib/utils.js";
import { getConversationForMember, isAdmin } from "../services/conversation.service.js";
import {
  EDIT_WINDOW_MS,
  assertCanSend,
  broadcastMessageUpdate,
  createMessage,
  getMessageForMember,
} from "../services/message.service.js";
import { serializeReminder } from "./reminder.controller.js";

const MAX_PENDING_REMINDERS = 100;

export const editMessage = async (req, res) => {
  const { message, conv } = await getMessageForMember(req.params.id, req.user._id);
  if (!sameId(message.sender, req.user._id) || message.type !== "user") throw forbidden("You can only edit your own messages");
  if (message.deletedAt) throw badRequest("This message was deleted");
  if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) throw badRequest("Messages can only be edited within 24 hours");
  if (message.forwarded) throw badRequest("Forwarded messages can't be edited");

  const text = req.data.text;
  if (text === message.text) return res.json({ message: serializeMessage(message) });

  message.text = text;
  message.editedAt = new Date();
  message.translations = undefined;
  await message.save();
  broadcastMessageUpdate(conv, message);
  res.json({ message: serializeMessage(message) });
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
  await message.save();
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
  res.json({ message: serializeMessage(fresh) });
};

export const forwardMessage = async (req, res) => {
  const { message } = await getMessageForMember(req.params.id, req.user._id);
  if (message.deletedAt || message.type !== "user") throw badRequest("This message can't be forwarded");

  const results = [];
  for (const conversationId of [...new Set(req.data.conversationIds)]) {
    const target = await getConversationForMember(conversationId, req.user._id);
    await assertCanSend(target, req.user._id);
    const { message: copy } = await createMessage({
      conversation: target,
      senderId: req.user._id,
      text: message.text,
      attachments: message.attachments.map((a) => (typeof a.toObject === "function" ? a.toObject() : a)),
      forwarded: true,
    });
    results.push(serializeMessage(copy));
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
