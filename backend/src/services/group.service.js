import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import {
  broadcastConversation,
  getMember,
  invalidateMembership,
  notifyRemoved,
} from "./conversation.service.js";
import { postSystemMessage } from "./message.service.js";
import { toObjectId } from "../lib/utils.js";

/**
 * Removes a member from a group (they left or were removed). Keeps the group
 * administrable by promoting the longest-standing member when the last admin
 * leaves, and deletes the group entirely once nobody is left.
 */
export async function removeMemberFromGroup(conv, userId, { actorId = userId, event = "member_left" } = {}) {
  const member = getMember(conv, userId);
  if (!member) return conv;
  const wasAdmin = member.role === "admin";

  await Conversation.updateOne({ _id: conv._id }, { $pull: { members: { user: toObjectId(userId) } } });
  invalidateMembership(conv, [userId]);
  notifyRemoved(conv._id, [userId]);

  let fresh = await Conversation.findById(conv._id);
  if (!fresh || fresh.members.length === 0) {
    await Message.deleteMany({ conversation: conv._id });
    await Conversation.deleteOne({ _id: conv._id });
    return null;
  }

  let promoted = null;
  if (wasAdmin && !fresh.members.some((m) => m.role === "admin")) {
    const next = [...fresh.members].sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))[0];
    await Conversation.updateOne({ _id: conv._id, "members.user": next.user }, { $set: { "members.$.role": "admin" } });
    promoted = next.user;
    fresh = await Conversation.findById(conv._id);
  }

  await postSystemMessage(fresh, actorId, event, { targets: [userId] });
  if (promoted) await postSystemMessage(fresh, promoted, "admin_auto", { targets: [promoted] });
  await broadcastConversation(fresh);
  return fresh;
}
