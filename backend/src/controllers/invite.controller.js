import Conversation from "../models/conversation.model.js";
import { badRequest, notFound } from "../lib/errors.js";
import { idStr, sameId } from "../lib/utils.js";
import { INVITE_CODE } from "../validation/schemas.js";
import {
  GROUP_MAX_MEMBERS,
  broadcastConversation,
  buildConversation,
  getMember,
  invalidateMembership,
  loadUsersMap,
} from "../services/conversation.service.js";
import { postSystemMessage } from "../services/message.service.js";

async function findByCode(code) {
  if (!INVITE_CODE.test(String(code))) throw notFound("This invite link is invalid or was reset");
  const conv = await Conversation.findOne({ type: "group", inviteCode: code });
  if (!conv) throw notFound("This invite link is invalid or was reset");
  return conv;
}

/** What you see before joining: name, photo, size and a few member names. */
export const previewInvite = async (req, res) => {
  const conv = await findByCode(req.params.code);
  const sample = conv.members.slice(0, 6).map((m) => m.user);
  const users = await loadUsersMap(sample);
  res.json({
    group: {
      _id: idStr(conv._id),
      name: conv.name,
      description: conv.description || "",
      avatar: conv.avatar || "",
      memberCount: conv.members.length,
      memberNames: sample.map((id) => users.get(idStr(id))?.fullName).filter(Boolean),
      isMember: Boolean(getMember(conv, req.user._id)),
      full: conv.members.length >= GROUP_MAX_MEMBERS,
    },
  });
};

export const joinByInvite = async (req, res) => {
  const conv = await findByCode(req.params.code);
  if (getMember(conv, req.user._id)) {
    return res.json({ conversation: await buildConversation(conv, req.user), alreadyMember: true });
  }
  if (conv.members.length >= GROUP_MAX_MEMBERS) throw badRequest("This group is full");

  const joinedAt = new Date(Date.now() - 1);
  const result = await Conversation.updateOne(
    { _id: conv._id, inviteCode: req.params.code, "members.user": { $ne: req.user._id } },
    { $push: { members: { user: req.user._id, role: "member", joinedAt, lastReadAt: joinedAt, lastDeliveredAt: joinedAt } } }
  );
  const fresh = await Conversation.findById(conv._id);
  if (result.modifiedCount) {
    invalidateMembership(fresh);
    await postSystemMessage(fresh, req.user._id, "member_joined_link", { targets: [req.user._id] });
    await broadcastConversation(fresh, "conversation:updated");
  }
  // The joiner's own devices get the chat as "new".
  const conversation = await buildConversation(fresh, req.user);
  res.status(201).json({ conversation, alreadyMember: !result.modifiedCount && fresh.members.some((m) => sameId(m.user, req.user._id)) });
};
