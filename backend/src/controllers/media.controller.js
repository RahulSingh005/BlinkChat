import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { env } from "../config/env.js";
import { searchMedia } from "../lib/klipy.js";
import { deletedUser, publicUser, serializeMessage } from "../lib/serializers.js";
import { hmac, idStr, sameId, toObjectId } from "../lib/utils.js";
import { getMember, loadUsersMap, visibleSince } from "../services/conversation.service.js";

/** GIF / sticker search through our KLIPY proxy (trending when q is empty). */
export const searchGifs = (kind) => async (req, res) => {
  const { q, page, limit, locale } = req.data;
  // KLIPY wants a stable per-user id; send a keyed hash, never our real ids.
  const customerId = hmac(idStr(req.user._id), `${env.JWT_SECRET}:klipy-customer`).slice(0, 32);
  const result = await searchMedia({ kind, q, page, perPage: limit, customerId, locale });
  res.set("Cache-Control", "private, max-age=300");
  res.json(result);
};

/** Recent calls across my 1:1 chats, newest first. */
export const callHistory = async (req, res) => {
  const me = req.user;
  const meId = toObjectId(me._id);
  const { before, limit } = req.data;

  const convs = await Conversation.find({ type: "direct", "members.user": me._id }).select("type members").lean();
  if (!convs.length) return res.json({ calls: [], hasMore: false });
  const clauses = convs.map((c) => ({ conversation: c._id, createdAt: { $gt: visibleSince(c, getMember(c, me._id)) } }));
  const and = [{ $or: clauses }];
  if (before) and.push({ createdAt: { $lt: before } });

  const page = await Message.find({ type: "call", hiddenFor: { $ne: meId }, $and: and })
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const convById = new Map(convs.map((c) => [idStr(c._id), c]));
  const peerOf = (convId) => convById.get(convId)?.members.find((m) => !sameId(m.user, me._id))?.user;
  const users = await loadUsersMap(page.map((m) => peerOf(idStr(m.conversation))).filter(Boolean));

  res.json({
    calls: page.slice(0, limit).map((m) => {
      const conversationId = idStr(m.conversation);
      const peerId = peerOf(conversationId);
      const peer = users.get(idStr(peerId));
      return {
        message: serializeMessage(m, me._id),
        conversationId,
        outgoing: sameId(m.sender, me._id),
        peer: peer ? publicUser(peer, me) : deletedUser(peerId),
      };
    }),
    hasMore: page.length > limit,
  });
};
