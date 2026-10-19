import Story, { STORY_TTL_MS } from "../models/story.model.js";
import User from "../models/user.model.js";
import { badRequest, notFound } from "../lib/errors.js";
import { getBlockedSet, getDirectContactIds, isBlockedEitherWay } from "../lib/cache.js";
import { emitToUser, emitToUsers } from "../lib/realtime.js";
import { publicUser, serializeMessage, USER_PUBLIC_FIELDS } from "../lib/serializers.js";
import { deleteStoredFile, isTrustedMediaUrl } from "../lib/storage.js";
import { idStr, isObjectId, sameId, toObjectId, truncate } from "../lib/utils.js";
import { findOrCreateDirect } from "../services/conversation.service.js";
import { assertCanSend, createMessage } from "../services/message.service.js";

const MAX_ACTIVE_STORIES = 30;

/**
 * Stories ("Status") are shared with the people you chat with 1:1, minus
 * anyone blocked either way. Returns the audience of `userId`'s stories.
 */
async function storyAudience(userId) {
  const contacts = await getDirectContactIds(userId);
  if (!contacts.length) return [];
  const mine = await getBlockedSet(userId);
  const others = await User.find({ _id: { $in: contacts }, blockedUsers: { $ne: toObjectId(userId) } })
    .select("_id")
    .lean();
  return others.map((u) => idStr(u._id)).filter((id) => !mine.has(id));
}

async function canSeeStoriesOf(viewerId, ownerId) {
  if (sameId(viewerId, ownerId)) return true;
  const contacts = await getDirectContactIds(ownerId);
  if (!contacts.includes(idStr(viewerId))) return false;
  return !(await isBlockedEitherWay(viewerId, ownerId));
}

const visibleViewers = (story) => (story.viewers || []).filter((v) => !v.hidden);

export function serializeStory(story, viewerId) {
  const isOwner = sameId(story.user, viewerId);
  const mine = (story.viewers || []).find((v) => sameId(v.user, viewerId));
  return {
    _id: idStr(story._id),
    user: idStr(story.user),
    kind: story.kind,
    text: story.text || "",
    background: story.background || "",
    font: story.font || "sans",
    caption: story.caption || "",
    media: story.media?.url
      ? {
          url: story.media.url,
          kind: story.media.kind,
          width: story.media.width ?? null,
          height: story.media.height ?? null,
          duration: story.media.duration ?? null,
        }
      : null,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    viewed: isOwner || Boolean(mine),
    myReaction: mine?.reaction || "",
    ...(isOwner ? { viewCount: visibleViewers(story).length } : {}),
  };
}

async function loadStory(id, viewerId) {
  if (!isObjectId(String(id))) throw notFound("This status is no longer available");
  const story = await Story.findOne({ _id: id, expiresAt: { $gt: new Date() } });
  if (!story || !(await canSeeStoriesOf(viewerId, story.user))) throw notFound("This status is no longer available");
  return story;
}

/** Everyone's active stories grouped by person: mine first, then unseen, then seen. */
export const listStories = async (req, res) => {
  const me = req.user;
  const contacts = await getDirectContactIds(me._id);
  const blocked = await getBlockedSet(me._id);
  const candidates = contacts.filter((id) => !blocked.has(id));

  const stories = await Story.find({
    user: { $in: [me._id, ...candidates.map(toObjectId)] },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: 1 })
    .lean();

  const ownerIds = [...new Set(stories.map((s) => idStr(s.user)))];
  const users = await User.find({ _id: { $in: ownerIds } }).select(USER_PUBLIC_FIELDS).lean();
  const byId = new Map(users.map((u) => [idStr(u._id), u]));

  const groups = new Map();
  for (const s of stories) {
    const owner = byId.get(idStr(s.user));
    // Skip people who blocked me (their audience check excludes me).
    if (!owner || (!sameId(owner._id, me._id) && owner.blockedUsers?.some((b) => sameId(b, me._id)))) continue;
    const key = idStr(s.user);
    if (!groups.has(key)) groups.set(key, { user: publicUser(owner, me), stories: [] });
    groups.get(key).stories.push(serializeStory(s, me._id));
  }

  const all = [...groups.values()].map((g) => ({
    ...g,
    lastAt: g.stories[g.stories.length - 1].createdAt,
    hasUnseen: g.stories.some((s) => !s.viewed),
  }));
  const mine = all.find((g) => g.user._id === idStr(me._id)) || null;
  const others = all
    .filter((g) => g !== mine)
    .sort((a, b) => Number(b.hasUnseen) - Number(a.hasUnseen) || new Date(b.lastAt) - new Date(a.lastAt));

  res.json({ mine, others });
};

export const createStory = async (req, res) => {
  const me = req.user;
  const { kind, text, background, font, caption, media } = req.data;
  if (media && !isTrustedMediaUrl(media.url)) throw badRequest("Upload the photo or video through BlinkChat first");

  const active = await Story.countDocuments({ user: me._id, expiresAt: { $gt: new Date() } });
  if (active >= MAX_ACTIVE_STORIES) throw badRequest(`You can have up to ${MAX_ACTIVE_STORIES} active status updates`);

  const story = await Story.create({
    user: me._id,
    kind,
    text: kind === "text" ? text : "",
    background: kind === "text" ? background : "",
    font,
    caption: kind === "text" ? "" : caption,
    media: kind === "text" ? null : media,
    expiresAt: new Date(Date.now() + STORY_TTL_MS),
  });

  const audience = await storyAudience(me._id);
  emitToUsers(audience, "story:new", { userId: idStr(me._id), storyId: idStr(story._id) });
  emitToUser(me._id, "story:new", { userId: idStr(me._id), storyId: idStr(story._id) });
  res.status(201).json({ story: serializeStory(story.toObject(), me._id) });
};

export const deleteStory = async (req, res) => {
  if (!isObjectId(String(req.params.id))) throw notFound("Status not found");
  const story = await Story.findOne({ _id: req.params.id, user: req.user._id });
  if (!story) throw notFound("Status not found");
  if (story.media) deleteStoredFile(story.media);
  await Story.deleteOne({ _id: story._id });
  const audience = await storyAudience(req.user._id);
  emitToUsers([...audience, idStr(req.user._id)], "story:deleted", { userId: idStr(req.user._id), storyId: idStr(story._id) });
  res.json({ deleted: true });
};

/** Records a view (idempotent). Owners get a live view counter. */
export const viewStory = async (req, res) => {
  const me = req.user;
  const story = await loadStory(req.params.id, me._id);
  if (sameId(story.user, me._id)) return res.json({ story: serializeStory(story.toObject(), me._id) });

  const hidden = me.settings?.readReceipts === false;
  const result = await Story.updateOne(
    { _id: story._id, "viewers.user": { $ne: me._id } },
    { $push: { viewers: { user: me._id, at: new Date(), hidden } } }
  );
  const fresh = await Story.findById(story._id).lean();
  if (result.modifiedCount && !hidden) {
    emitToUser(story.user, "story:viewed", { storyId: idStr(story._id), viewCount: visibleViewers(fresh).length });
  }
  res.json({ story: serializeStory(fresh, me._id) });
};

export const reactToStory = async (req, res) => {
  const me = req.user;
  const story = await loadStory(req.params.id, me._id);
  if (sameId(story.user, me._id)) throw badRequest("You can't react to your own status");
  const { emoji } = req.data;

  const hidden = me.settings?.readReceipts === false;
  const updated = await Story.updateOne(
    { _id: story._id, "viewers.user": me._id },
    { $set: { "viewers.$.reaction": emoji } }
  );
  if (!updated.matchedCount) {
    await Story.updateOne(
      { _id: story._id, "viewers.user": { $ne: me._id } },
      { $push: { viewers: { user: me._id, at: new Date(), reaction: emoji, hidden } } }
    );
  }
  const fresh = await Story.findById(story._id).lean();
  emitToUser(story.user, "story:viewed", {
    storyId: idStr(story._id),
    viewCount: visibleViewers(fresh).length,
    reaction: hidden ? undefined : { userId: idStr(me._id), name: me.fullName, emoji },
  });
  res.json({ story: serializeStory(fresh, me._id) });
};

export const storyViewers = async (req, res) => {
  if (!isObjectId(String(req.params.id))) throw notFound("Status not found");
  const story = await Story.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!story) throw notFound("Status not found");
  // Like WhatsApp: with read receipts off you don't see who viewed yours.
  if (req.user.settings?.readReceipts === false) return res.json({ viewers: [], receiptsOff: true, total: 0 });

  const viewers = visibleViewers(story).sort((a, b) => new Date(b.at) - new Date(a.at));
  const users = await User.find({ _id: { $in: viewers.map((v) => v.user) } })
    .select(USER_PUBLIC_FIELDS)
    .lean();
  const byId = new Map(users.map((u) => [idStr(u._id), u]));
  res.json({
    total: viewers.length,
    viewers: viewers
      .filter((v) => byId.has(idStr(v.user)))
      .map((v) => ({ user: publicUser(byId.get(idStr(v.user)), req.user), at: v.at, reaction: v.reaction || "" })),
  });
};

/** Replying to a story sends a quoted direct message to its owner. */
export const replyToStory = async (req, res) => {
  const me = req.user;
  const story = await loadStory(req.params.id, me._id);
  if (sameId(story.user, me._id)) throw badRequest("You can't reply to your own status");

  const conv = await findOrCreateDirect(me, story.user);
  await assertCanSend(conv, me._id);
  const { message } = await createMessage({
    conversation: conv,
    senderId: me._id,
    text: req.data.text,
    storyReply: {
      story: story._id,
      owner: story.user,
      storyType: story.kind,
      text: truncate(story.kind === "text" ? story.text : story.caption, 160),
      background: story.background || "",
      mediaUrl: story.media?.url || "",
      mediaKind: story.media?.kind || "",
    },
  });
  res.status(201).json({ message: serializeMessage(message, me._id), conversationId: idStr(conv._id) });
};

/** Deletes expired stories and their media (called by the scheduler). */
export async function sweepExpiredStories(limit = 50) {
  const expired = await Story.find({ expiresAt: { $lte: new Date() } })
    .select("_id media")
    .limit(limit)
    .lean();
  if (!expired.length) return 0;
  expired.forEach((s) => s.media && deleteStoredFile(s.media));
  await Story.deleteMany({ _id: { $in: expired.map((s) => s._id) } });
  return expired.length;
}
