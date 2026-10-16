import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { env } from "../config/env.js";
import { badRequest, notFound } from "../lib/errors.js";
import { invalidateBlocks } from "../lib/cache.js";
import { emitToUser, isOnline } from "../lib/realtime.js";
import { publicUser, USER_PUBLIC_FIELDS } from "../lib/serializers.js";
import { escapeRegex, idStr, isObjectId, maskEmail, sameId } from "../lib/utils.js";
import { directKeyFor } from "../services/conversation.service.js";

const withSearchFields = `${USER_PUBLIC_FIELDS} email`;

const toResult = (user, viewer) => ({
  ...publicUser(user, viewer),
  emailHint: maskEmail(user.email),
  blocked: viewer.blockedUsers?.some((id) => sameId(id, user._id)) || false,
  online: publicUser(user, viewer).presenceVisible ? isOnline(user._id) : false,
});

/**
 * People search for "New chat". Exact email matches always work; name search
 * matches word prefixes. With an empty query we return a small, paginated
 * directory (or nothing when PUBLIC_DIRECTORY=false) instead of dumping
 * every account like the old /messages/users endpoint did.
 */
export const searchUsers = async (req, res) => {
  const { q, limit } = req.data;
  const viewer = req.user;
  const base = { _id: { $ne: viewer._id }, blockedUsers: { $ne: viewer._id } };

  let filter;
  if (!q) {
    if (!env.PUBLIC_DIRECTORY) return res.json({ users: [] });
    filter = base;
  } else if (q.includes("@")) {
    filter = { ...base, email: q.toLowerCase() };
  } else {
    if (!env.PUBLIC_DIRECTORY && q.length < 3) return res.json({ users: [] });
    filter = { ...base, fullName: new RegExp(`(^|\\s)${escapeRegex(q)}`, "i") };
  }

  const users = await User.find(filter)
    .select(withSearchFields)
    .sort(q ? { fullName: 1 } : { lastSeen: -1 })
    .limit(limit)
    .lean();

  res.json({ users: users.map((u) => toResult(u, viewer)) });
};

export const getUser = async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) throw notFound("User not found");
  const user = await User.findById(id).select(withSearchFields).lean();
  if (!user) throw notFound("User not found");

  const viewer = req.user;
  const direct = await Conversation.findOne({ directKey: directKeyFor(viewer._id, user._id) }).select("_id").lean();
  const commonGroups = await Conversation.find({
    type: "group",
    "members.user": { $all: [viewer._id, user._id] },
  })
    .select("_id name avatar")
    .limit(20)
    .lean();

  res.json({
    user: toResult(user, viewer),
    conversationId: direct ? idStr(direct._id) : null,
    commonGroups: commonGroups.map((g) => ({ _id: idStr(g._id), name: g.name, avatar: g.avatar })),
  });
};

export const listBlocked = async (req, res) => {
  const users = await User.find({ _id: { $in: req.user.blockedUsers || [] } })
    .select(withSearchFields)
    .lean();
  res.json({ users: users.map((u) => toResult(u, req.user)) });
};

export const toggleBlock = async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) throw notFound("User not found");
  if (sameId(id, req.user._id)) throw badRequest("You can't block yourself");
  if (!(await User.exists({ _id: id }))) throw notFound("User not found");

  const isBlocked = req.user.blockedUsers?.some((b) => sameId(b, id));
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    isBlocked ? { $pull: { blockedUsers: id } } : { $addToSet: { blockedUsers: id } },
    { new: true }
  );
  invalidateBlocks(req.user._id);

  const blockedUsers = updated.blockedUsers.map(idStr);
  emitToUser(req.user._id, "me:blocks", { blockedUsers });

  // The other person's view of us changes (photo, presence...). Send them a
  // refreshed profile without revealing that it's because of a block.
  const other = await User.findById(id).select("_id settings").lean();
  if (other) emitToUser(id, "user:updated", { user: publicUser(updated, other) });

  res.json({ blocked: !isBlocked, blockedUsers });
};
