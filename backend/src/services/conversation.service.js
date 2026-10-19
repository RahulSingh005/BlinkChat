import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { emitToUser, emitToUsers } from "../lib/realtime.js";
import { invalidateContacts, invalidateConversation } from "../lib/cache.js";
import { serializeConversation, USER_PUBLIC_FIELDS } from "../lib/serializers.js";
import { idStr, isObjectId, sameId, toObjectId, uniqueIds } from "../lib/utils.js";

export const GROUP_MAX_MEMBERS = 256;

export const directKeyFor = (a, b) => [idStr(a), idStr(b)].sort().join(":");

export const getMember = (conv, userId) => conv?.members?.find((m) => sameId(m.user, userId));

export const isAdmin = (conv, userId) => getMember(conv, userId)?.role === "admin";

/** Loads a conversation the user belongs to, or throws 404. */
export async function getConversationForMember(conversationId, userId, { lean = false } = {}) {
  if (!isObjectId(String(conversationId))) throw notFound("Conversation not found");
  const query = Conversation.findOne({ _id: conversationId, "members.user": userId });
  const conv = lean ? await query.lean() : await query;
  if (!conv) throw notFound("Conversation not found");
  return conv;
}

/** Earliest message timestamp this member may see (clear chat / join date). */
export function visibleSince(conv, member) {
  const cleared = member?.clearedAt ? new Date(member.clearedAt).getTime() : 0;
  const joined = conv.type === "group" && member?.joinedAt ? new Date(member.joinedAt).getTime() : 0;
  return new Date(Math.max(cleared, joined, 0));
}

export async function loadUsersMap(ids) {
  const users = await User.find({ _id: { $in: uniqueIds(ids) } })
    .select(USER_PUBLIC_FIELDS)
    .lean();
  return new Map(users.map((u) => [idStr(u._id), u]));
}

/** Latest message visible to `viewerId`, honoring clear-chat/join dates. */
export async function lastVisibleMessage(conv, viewerId) {
  const member = getMember(conv, viewerId);
  return Message.findOne({
    conversation: conv._id,
    hiddenFor: { $ne: toObjectId(viewerId) },
    createdAt: { $gt: visibleSince(conv, member) },
  })
    .sort({ createdAt: -1 })
    .lean();
}

/** Pinned message documents for a set of conversations (one query). */
export async function loadPinnedMessages(convs) {
  const ids = convs.flatMap((c) => (c.pinned || []).map((p) => p.message));
  if (!ids.length) return [];
  return Message.find({ _id: { $in: ids } }).lean();
}

/** Serializes one conversation for a viewer (loads members + last message). */
export async function buildConversation(conv, viewer, { withLastMessage = true } = {}) {
  const [usersById, pinned] = await Promise.all([loadUsersMap(conv.members.map((m) => m.user)), loadPinnedMessages([conv])]);
  const last = withLastMessage ? await lastVisibleMessage(conv, viewer._id) : undefined;
  return serializeConversation(conv, viewer, usersById, last, pinned);
}

/**
 * Sidebar list: one aggregation fetches every conversation plus the latest
 * message each member can see — unread counts and previews now survive a
 * page refresh (they used to live only in browser memory).
 */
export async function listConversationsFor(viewer) {
  const meId = toObjectId(viewer._id);
  const convs = await Conversation.aggregate([
    { $match: { "members.user": meId } },
    {
      $addFields: {
        _me: { $first: { $filter: { input: "$members", cond: { $eq: ["$$this.user", meId] } } } },
      },
    },
    {
      $match: {
        "_me.hidden": { $ne: true },
        $or: [{ type: "group" }, { lastMessageAt: { $ne: null } }, { createdBy: meId }],
      },
    },
    {
      $addFields: {
        _since: {
          $max: [
            { $ifNull: ["$_me.clearedAt", new Date(0)] },
            { $cond: [{ $eq: ["$type", "group"] }, { $ifNull: ["$_me.joinedAt", new Date(0)] }, new Date(0)] },
          ],
        },
      },
    },
    { $sort: { lastMessageAt: -1, updatedAt: -1 } },
    { $limit: 500 },
    {
      $lookup: {
        from: "messages",
        localField: "_id",
        foreignField: "conversation",
        let: { since: "$_since" },
        pipeline: [
          { $match: { $expr: { $gt: ["$createdAt", "$$since"] }, hiddenFor: { $ne: meId } } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
        ],
        as: "_last",
      },
    },
  ]);

  const [usersById, pinned] = await Promise.all([
    loadUsersMap(convs.flatMap((c) => c.members.map((m) => m.user))),
    loadPinnedMessages(convs),
  ]);
  return convs.map((c) => serializeConversation(c, viewer, usersById, c._last[0] || null, pinned));
}

/** Gets (or atomically creates) the single direct chat between two users. */
/** "Saved Messages": a private chat with yourself for notes, links and files. */
export async function findOrCreateSelf(me) {
  const directKey = `self:${idStr(me._id)}`;
  let conv = await Conversation.findOne({ directKey });
  if (!conv) {
    try {
      conv = await Conversation.create({ type: "self", directKey, createdBy: me._id, members: [{ user: me._id }] });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      conv = await Conversation.findOne({ directKey });
    }
  }
  return conv;
}

export async function findOrCreateDirect(me, otherUserId) {
  if (sameId(me._id, otherUserId)) return findOrCreateSelf(me);
  const other = await User.findById(otherUserId).select("_id").lean();
  if (!other) throw notFound("User not found");

  const directKey = directKeyFor(me._id, other._id);
  let conv = await Conversation.findOne({ directKey });
  if (!conv) {
    try {
      conv = await Conversation.create({
        type: "direct",
        directKey,
        createdBy: me._id,
        members: [{ user: me._id }, { user: other._id }],
      });
      invalidateContacts([me._id, other._id]);
    } catch (err) {
      if (err?.code !== 11000) throw err;
      conv = await Conversation.findOne({ directKey }); // lost a creation race
    }
  }

  const member = getMember(conv, me._id);
  if (member?.hidden) {
    await Conversation.updateOne({ _id: conv._id, "members.user": me._id }, { $set: { "members.$.hidden": false } });
    member.hidden = false;
  }
  return conv;
}

/** Sends each member their own serialized view of the conversation. */
export async function broadcastConversation(conv, event = "conversation:updated", { extraUserIds = [] } = {}) {
  const fresh = await Conversation.findById(conv._id).lean();
  if (!fresh) return;
  const memberIds = fresh.members.map((m) => idStr(m.user));
  const [usersById, pinned] = await Promise.all([loadUsersMap([...memberIds, ...extraUserIds]), loadPinnedMessages([fresh])]);
  await Promise.all(
    memberIds.map(async (uid) => {
      const viewer = usersById.get(uid);
      if (!viewer) return;
      const last = await lastVisibleMessage(fresh, uid);
      emitToUser(uid, event, { conversation: serializeConversation(fresh, viewer, usersById, last, pinned) });
    })
  );
}

export function notifyRemoved(conversationId, userIds) {
  emitToUsers(userIds, "conversation:removed", { conversationId: idStr(conversationId) });
}

export function assertGroupAdmin(conv, userId) {
  if (conv.type !== "group") throw badRequest("This only works in groups");
  if (!isAdmin(conv, userId)) throw forbidden("Only group admins can do that");
}

export function invalidateMembership(conv, extraUserIds = []) {
  invalidateConversation(conv._id);
  invalidateContacts([...conv.members.map((m) => m.user), ...extraUserIds]);
}
