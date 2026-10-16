import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import ScheduledMessage from "../models/scheduledMessage.model.js";
import User from "../models/user.model.js";
import { badRequest, notFound } from "../lib/errors.js";
import { emitToUser, emitToUsers } from "../lib/realtime.js";
import { hasBlocked, serializeMessage } from "../lib/serializers.js";
import { deleteImageByUrl, isTrustedMediaUrl } from "../lib/storage.js";
import { escapeRegex, idStr, sameId, toObjectId, uniqueIds } from "../lib/utils.js";
import {
  GROUP_MAX_MEMBERS,
  assertGroupAdmin,
  broadcastConversation,
  buildConversation,
  findOrCreateDirect,
  getConversationForMember,
  getMember,
  invalidateMembership,
  listConversationsFor,
  visibleSince,
} from "../services/conversation.service.js";
import { assertCanSend, createMessage, postSystemMessage, validateAttachments } from "../services/message.service.js";
import { removeMemberFromGroup } from "../services/group.service.js";

const MAX_PINNED = 5;
const FOREVER = new Date("9999-12-31T00:00:00Z");
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

// Joining 1ms in the past guarantees the member sees the system message
// announcing their arrival (created right after), but nothing older.
const joinTime = () => new Date(Date.now() - 1);

export const listConversations = async (req, res) => {
  res.json({ conversations: await listConversationsFor(req.user) });
};

export const getConversation = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id, { lean: true });
  res.json({ conversation: await buildConversation(conv, req.user) });
};

export const openDirect = async (req, res) => {
  const conv = await findOrCreateDirect(req.user, req.data.userId);
  res.json({ conversation: await buildConversation(conv, req.user) });
};

export const createGroup = async (req, res) => {
  const { name, description, avatar, memberIds } = req.data;
  const me = req.user;
  if (avatar && !isTrustedMediaUrl(avatar)) throw badRequest("Please upload the group photo through BlinkChat");

  const ids = uniqueIds(memberIds).filter((id) => id !== idStr(me._id));
  if (!ids.length) throw badRequest("Add at least one member");
  if (ids.length + 1 > GROUP_MAX_MEMBERS) throw badRequest(`Groups are limited to ${GROUP_MAX_MEMBERS} members`);

  const users = await User.find({ _id: { $in: ids } }).select("_id blockedUsers").lean();
  const allowed = users.filter((u) => !hasBlocked(u, me._id));
  if (!allowed.length) throw badRequest("None of these people can be added");

  const joinedAt = joinTime();
  const conv = await Conversation.create({
    type: "group",
    name,
    description,
    avatar,
    createdBy: me._id,
    lastMessageAt: new Date(),
    members: [
      { user: me._id, role: "admin", joinedAt, lastReadAt: new Date() },
      ...allowed.map((u) => ({ user: u._id, role: "member", joinedAt, lastReadAt: joinedAt })),
    ],
  });
  invalidateMembership(conv);

  await postSystemMessage(conv, me._id, "group_created", { data: { name } });
  await broadcastConversation(conv, "conversation:new");
  res.status(201).json({ conversation: await buildConversation(conv, me) });
};

export const updateGroup = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id);
  assertGroupAdmin(conv, req.user._id);
  const { name, description, avatar } = req.data;
  const events = [];

  if (name !== undefined && name !== conv.name) {
    conv.name = name;
    events.push(["renamed", { name }]);
  }
  if (description !== undefined && description !== conv.description) {
    conv.description = description;
    events.push(["description_changed", null]);
  }
  if (avatar !== undefined && avatar !== conv.avatar) {
    if (avatar && !isTrustedMediaUrl(avatar)) throw badRequest("Please upload the group photo through BlinkChat");
    deleteImageByUrl(conv.avatar);
    conv.avatar = avatar;
    events.push([avatar ? "avatar_changed" : "avatar_removed", null]);
  }
  if (!events.length) return res.json({ conversation: await buildConversation(conv, req.user) });

  await conv.save();
  for (const [event, data] of events) await postSystemMessage(conv, req.user._id, event, { data });
  await broadcastConversation(conv);
  res.json({ conversation: await buildConversation(conv, req.user) });
};

export const addMembers = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id);
  assertGroupAdmin(conv, req.user._id);

  const existing = new Set(conv.members.map((m) => idStr(m.user)));
  const ids = uniqueIds(req.data.userIds).filter((id) => !existing.has(id));
  if (!ids.length) throw badRequest("They're already in this group");
  if (conv.members.length + ids.length > GROUP_MAX_MEMBERS) {
    throw badRequest(`Groups are limited to ${GROUP_MAX_MEMBERS} members`);
  }

  const users = await User.find({ _id: { $in: ids } }).select("_id blockedUsers").lean();
  const allowed = users.filter((u) => !hasBlocked(u, req.user._id));
  if (!allowed.length) throw badRequest("These people can't be added");

  const joinedAt = joinTime();
  await Conversation.updateOne(
    { _id: conv._id },
    {
      $push: {
        members: {
          $each: allowed.map((u) => ({ user: u._id, role: "member", joinedAt, lastReadAt: joinedAt, lastDeliveredAt: joinedAt })),
        },
      },
    }
  );
  const fresh = await Conversation.findById(conv._id);
  invalidateMembership(fresh);
  await postSystemMessage(fresh, req.user._id, "members_added", { targets: allowed.map((u) => u._id) });
  await broadcastConversation(fresh);
  res.json({ conversation: await buildConversation(fresh, req.user) });
};

export const removeMember = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id);
  if (conv.type !== "group") throw badRequest("This only works in groups");
  const targetId = req.params.userId;

  if (sameId(targetId, req.user._id)) {
    await removeMemberFromGroup(conv, req.user._id, { event: "member_left" });
    return res.json({ left: true });
  }

  assertGroupAdmin(conv, req.user._id);
  if (!getMember(conv, targetId)) throw notFound("That person isn't in this group");
  await removeMemberFromGroup(conv, targetId, { actorId: req.user._id, event: "member_removed" });
  res.json({ removed: true });
};

export const setMemberRole = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id);
  assertGroupAdmin(conv, req.user._id);
  const target = getMember(conv, req.params.userId);
  if (!target) throw notFound("That person isn't in this group");

  const { role } = req.data;
  if (target.role === role) return res.json({ conversation: await buildConversation(conv, req.user) });
  if (role === "member" && conv.members.filter((m) => m.role === "admin").length <= 1) {
    throw badRequest("A group needs at least one admin. Make someone else an admin first.");
  }

  await Conversation.updateOne({ _id: conv._id, "members.user": target.user }, { $set: { "members.$.role": role } });
  const fresh = await Conversation.findById(conv._id);
  await postSystemMessage(fresh, req.user._id, role === "admin" ? "admin_granted" : "admin_revoked", {
    targets: [target.user],
  });
  await broadcastConversation(fresh);
  res.json({ conversation: await buildConversation(fresh, req.user) });
};

/** Marks everything read; read receipts only go to people who also share them. */
export const markRead = async (req, res) => {
  const me = req.user;
  const conv = await getConversationForMember(req.params.id, me._id, { lean: true });
  const at = new Date();
  await Conversation.updateOne(
    { _id: conv._id, "members.user": me._id },
    { $set: { "members.$.lastReadAt": at, "members.$.lastDeliveredAt": at, "members.$.unreadCount": 0 } }
  );

  const conversationId = idStr(conv._id);
  emitToUser(me._id, "conversation:read", { conversationId, userId: idStr(me._id), at, self: true });

  const others = conv.members.filter((m) => !sameId(m.user, me._id)).map((m) => m.user);
  if (others.length) {
    emitToUsers(others, "conversation:delivered", { conversationId, userIds: [idStr(me._id)], at });
    if (me.settings?.readReceipts !== false) {
      const sharing = await User.find({ _id: { $in: others }, "settings.readReceipts": { $ne: false } })
        .select("_id")
        .lean();
      emitToUsers(
        sharing.map((u) => u._id),
        "conversation:read",
        { conversationId, userId: idStr(me._id), at }
      );
    }
  }
  res.json({ at });
};

export const updateMySettings = async (req, res) => {
  const me = req.user;
  const conv = await getConversationForMember(req.params.id, me._id, { lean: true });
  const { muteFor, pinned, archived } = req.data;
  const $set = {};

  if (muteFor !== undefined) {
    $set["members.$.mutedUntil"] = muteFor === null ? null : muteFor === -1 ? FOREVER : new Date(Date.now() + muteFor * 1000);
  }
  if (pinned !== undefined) {
    if (pinned && !getMember(conv, me._id)?.pinnedAt) {
      const pinnedCount = await Conversation.countDocuments({
        members: { $elemMatch: { user: me._id, pinnedAt: { $ne: null }, hidden: { $ne: true } } },
      });
      if (pinnedCount >= MAX_PINNED) throw badRequest(`You can pin up to ${MAX_PINNED} chats`);
    }
    $set["members.$.pinnedAt"] = pinned ? new Date() : null;
  }
  if (archived !== undefined) $set["members.$.archived"] = archived;
  if (!Object.keys($set).length) throw badRequest("Nothing to update");

  await Conversation.updateOne({ _id: conv._id, "members.user": me._id }, { $set });
  const fresh = await Conversation.findById(conv._id).lean();
  const conversation = await buildConversation(fresh, me, { withLastMessage: false });
  emitToUser(me._id, "conversation:me", { conversationId: conversation._id, me: conversation.me });
  res.json({ me: conversation.me });
};

export const setDisappearing = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id);
  if (conv.type === "group") assertGroupAdmin(conv, req.user._id);
  else await assertCanSend(conv, req.user._id);

  const { seconds } = req.data;
  if (conv.disappearingSeconds === seconds) return res.json({ conversation: await buildConversation(conv, req.user) });
  conv.disappearingSeconds = seconds;
  await conv.save();
  await postSystemMessage(conv, req.user._id, "disappearing", { data: { seconds } });
  await broadcastConversation(conv);
  res.json({ conversation: await buildConversation(conv, req.user) });
};

/** "Clear chat": hides history for me only (it used to delete it for both). */
export const clearChat = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id, { lean: true });
  const at = new Date();
  await Conversation.updateOne(
    { _id: conv._id, "members.user": req.user._id },
    { $set: { "members.$.clearedAt": at, "members.$.lastReadAt": at, "members.$.unreadCount": 0 } }
  );
  emitToUser(req.user._id, "conversation:cleared", { conversationId: idStr(conv._id), at });
  res.json({ clearedAt: at });
};

/** "Delete chat": clears + hides a direct chat for me; leaves a group. */
export const deleteChat = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id);
  if (conv.type === "group") {
    await removeMemberFromGroup(conv, req.user._id, { event: "member_left" });
  } else {
    const at = new Date();
    await Conversation.updateOne(
      { _id: conv._id, "members.user": req.user._id },
      {
        $set: {
          "members.$.clearedAt": at,
          "members.$.lastReadAt": at,
          "members.$.unreadCount": 0,
          "members.$.hidden": true,
          "members.$.pinnedAt": null,
        },
      }
    );
  }
  emitToUser(req.user._id, "conversation:removed", { conversationId: idStr(conv._id) });
  res.json({ deleted: true });
};

// ---- Messages inside a conversation -----------------------------------------

const baseMessageFilter = (conv, userId) => ({
  conversation: conv._id,
  hiddenFor: { $ne: toObjectId(userId) },
  createdAt: { $gt: visibleSince(conv, getMember(conv, userId)) },
});

const cursorClause = (ref, direction, inclusive = false) => {
  const op = direction === "older" ? "$lt" : "$gt";
  const idOp = inclusive ? `${op}e` : op;
  return {
    $or: [{ createdAt: { [op]: ref.createdAt } }, { createdAt: ref.createdAt, _id: { [idOp]: ref._id } }],
  };
};

/**
 * Cursor pagination: `before` (older page), `after` (newer page) or `around`
 * (jump to a search result / replied message). Previously every message in
 * the chat was loaded at once.
 */
export const getMessages = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id, { lean: true });
  const base = baseMessageFilter(conv, req.user._id);
  const { before, after, around, limit } = req.data;

  const findRef = async (id) => {
    const ref = await Message.findOne({ _id: id, conversation: conv._id }).select("_id createdAt").lean();
    if (!ref) throw notFound("Message not found");
    return ref;
  };
  const older = (filter, n) => Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(n).lean();
  const newer = (filter, n) => Message.find(filter).sort({ createdAt: 1, _id: 1 }).limit(n).lean();

  let messages;
  let hasMore = false;
  let hasNewer = false;

  if (around) {
    const ref = await findRef(around);
    const half = Math.ceil(limit / 2);
    const [olderPage, newerPage] = await Promise.all([
      older({ ...base, ...cursorClause(ref, "older", true) }, half + 1),
      newer({ ...base, ...cursorClause(ref, "newer") }, half + 1),
    ]);
    hasMore = olderPage.length > half;
    hasNewer = newerPage.length > half;
    messages = [...olderPage.slice(0, half).reverse(), ...newerPage.slice(0, half)];
  } else if (after) {
    const ref = await findRef(after);
    const page = await newer({ ...base, ...cursorClause(ref, "newer") }, limit + 1);
    hasNewer = page.length > limit;
    messages = page.slice(0, limit);
  } else {
    const filter = before ? { ...base, ...cursorClause(await findRef(before), "older") } : base;
    const page = await older(filter, limit + 1);
    hasMore = page.length > limit;
    messages = page.slice(0, limit).reverse();
  }

  res.json({ messages: messages.map(serializeMessage), hasMore, hasNewer });
};

export const searchMessages = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id, { lean: true });
  const regex = new RegExp(escapeRegex(req.data.q), "i");
  const results = await Message.find({
    ...baseMessageFilter(conv, req.user._id),
    type: "user",
    deletedAt: null,
    $or: [{ text: regex }, { "attachments.name": regex }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ messages: results.map(serializeMessage) });
};

export const getMedia = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id, { lean: true });
  const { kind, before, limit } = req.data;
  const kinds = kind === "files" ? ["file"] : kind === "audio" ? ["audio"] : ["image", "video"];
  const filter = { ...baseMessageFilter(conv, req.user._id), deletedAt: null, "attachments.kind": { $in: kinds } };
  if (before) {
    const ref = await Message.findOne({ _id: before, conversation: conv._id }).select("_id createdAt").lean();
    if (ref) Object.assign(filter, cursorClause(ref, "older"));
  }
  const page = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  res.json({ messages: page.slice(0, limit).map(serializeMessage), hasMore: page.length > limit });
};

export const sendMessage = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id);
  await assertCanSend(conv, req.user._id);
  const { text, replyTo, urgent, clientId } = req.data;
  const attachments = validateAttachments(req.data.attachments);

  const { message, duplicate } = await createMessage({
    conversation: conv,
    senderId: req.user._id,
    text,
    attachments,
    replyTo,
    urgent,
    clientId,
  });
  res.status(duplicate ? 200 : 201).json({ message: serializeMessage(message) });
};

// ---- Scheduled messages ("Send later" / "their morning") -------------------

const serializeScheduled = (s) => ({
  _id: idStr(s._id),
  conversation: idStr(s.conversation),
  text: s.text,
  attachments: s.attachments || [],
  replyTo: s.replyTo ? idStr(s.replyTo) : null,
  urgent: Boolean(s.urgent),
  sendAt: s.sendAt,
  status: s.status,
  error: s.error || "",
  createdAt: s.createdAt,
});

export const listScheduled = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id, { lean: true });
  const items = await ScheduledMessage.find({ conversation: conv._id, sender: req.user._id, status: { $in: ["pending", "failed"] } })
    .sort({ sendAt: 1 })
    .lean();
  res.json({ scheduled: items.map(serializeScheduled) });
};

export const createScheduled = async (req, res) => {
  const conv = await getConversationForMember(req.params.id, req.user._id);
  await assertCanSend(conv, req.user._id);
  const { text, replyTo, urgent, sendAt } = req.data;

  const ms = sendAt.getTime() - Date.now();
  if (ms < 30 * 1000) throw badRequest("Pick a time at least a minute from now");
  if (ms > MAX_SCHEDULE_AHEAD_MS) throw badRequest("You can schedule up to a year ahead");

  const pending = await ScheduledMessage.countDocuments({ sender: req.user._id, status: "pending" });
  if (pending >= 100) throw badRequest("You have too many scheduled messages");

  const item = await ScheduledMessage.create({
    conversation: conv._id,
    sender: req.user._id,
    text: text.trim(),
    attachments: validateAttachments(req.data.attachments),
    replyTo: replyTo || null,
    urgent,
    sendAt,
  });
  const payload = serializeScheduled(item.toObject());
  emitToUser(req.user._id, "scheduled:changed", { conversationId: payload.conversation });
  res.status(201).json({ scheduled: payload });
};
