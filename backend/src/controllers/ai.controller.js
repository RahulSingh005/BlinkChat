import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { env } from "../config/env.js";
import { aiStatus, complete, parseJsonLoose, transcribeAudio } from "../lib/ai.js";
import { badRequest, notFound, tooMany } from "../lib/errors.js";
import { readStoredFile } from "../lib/storage.js";
import { idStr, sameId, todayKey, toObjectId, truncate, uniqueIds } from "../lib/utils.js";
import { getConversationForMember, getMember, visibleSince } from "../services/conversation.service.js";
import { broadcastMessageUpdate, getMessageForMember } from "../services/message.service.js";

const languageName = (code) => {
  const value = String(code || "").trim();
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(value)) return value || "English";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(value) || value;
  } catch {
    return value;
  }
};

/** Shared per-user daily budget so one person can't drain the free quota. */
async function consumeQuota(userId) {
  const limit = env.AI_DAILY_LIMIT_PER_USER;
  const day = todayKey();
  const bumped = await User.updateOne(
    { _id: userId, "aiUsage.day": day, "aiUsage.count": { $lt: limit } },
    { $inc: { "aiUsage.count": 1 } }
  );
  if (bumped.modifiedCount) return;
  const reset = await User.updateOne({ _id: userId, "aiUsage.day": { $ne: day } }, { $set: { aiUsage: { day, count: 1 } } });
  if (reset.modifiedCount) return;
  throw tooMany("You've used today's AI allowance. It resets tomorrow.");
}

const describeMessage = (m) => {
  if (m.deletedAt) return "[deleted message]";
  if (m.type === "call") return `[${m.call?.kind || "voice"} call: ${m.call?.status || ""}]`;
  const parts = [];
  for (const a of m.attachments || []) {
    if (a.kind === "audio" && a.voice) parts.push(m.transcript ? `[voice message: "${truncate(m.transcript, 300)}"]` : "[voice message]");
    else if (a.kind === "file") parts.push(`[file: ${a.name || "document"}]`);
    else parts.push(`[${a.kind}]`);
  }
  if (m.text) parts.push(m.text);
  return parts.join(" ");
};

/** Renders messages as "Name: text" lines, capped to a character budget. */
async function buildTranscript(messages, viewer, maxChars = 12000) {
  const ids = uniqueIds(messages.map((m) => m.sender));
  const users = await User.find({ _id: { $in: ids } }).select("fullName").lean();
  const names = new Map(users.map((u) => [idStr(u._id), u.fullName.split(" ")[0]]));
  const meName = viewer.fullName.split(" ")[0];

  const lines = [];
  let used = 0;
  for (const m of [...messages].reverse()) {
    if (m.type === "system") continue;
    const who = sameId(m.sender, viewer._id) ? `${meName} (me)` : names.get(idStr(m.sender)) || "Someone";
    const time = new Date(m.createdAt).toISOString().slice(0, 16).replace("T", " ");
    const line = `[${time}] ${who}: ${truncate(describeMessage(m), 600)}`;
    if (used + line.length > maxChars) break;
    lines.unshift(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

export const getStatus = (req, res) => {
  res.json(aiStatus());
};

export const summarize = async (req, res) => {
  const { conversationId, mode } = req.data;
  const conv = await getConversationForMember(conversationId, req.user._id, { lean: true });
  const member = getMember(conv, req.user._id);
  const filter = {
    conversation: conv._id,
    hiddenFor: { $ne: toObjectId(req.user._id) },
    createdAt: { $gt: visibleSince(conv, member) },
    type: { $ne: "system" },
  };

  // "Unread" = everything after the moment the user last read the chat
  // (the client sends it, since opening the chat marks it read).
  const { since } = req.data;
  if (mode === "unread" && since) {
    filter.createdAt = { $gt: new Date(Math.max(since.getTime(), filter.createdAt.$gt.getTime())) };
  }

  const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(mode === "unread" ? 200 : 80).lean();
  if (messages.length < 2) {
    return res.json({ summary: "There isn't enough new conversation to summarize yet.", count: messages.length });
  }

  await consumeQuota(req.user._id);
  const meName = req.user.fullName.split(" ")[0];
  const transcript = await buildTranscript(messages.reverse(), req.user);
  const summary = await complete({
    system:
      `You are the catch-up assistant inside the BlinkChat messaging app. Summarize the chat excerpt for ${meName}, who is catching up. ` +
      "Write 2-6 short bullet points, each starting with \"• \". Use first names to say who said what. " +
      `Call out questions or requests aimed at ${meName}, decisions, plans, dates/times and shared files. ` +
      "Keep it under 120 words and write in the main language of the conversation. " +
      "Never invent details; if little happened, say so in one bullet. Output only the bullet points.",
    prompt: `Chat excerpt (oldest first):\n${transcript}`,
    maxTokens: 1500,
    temperature: 0.3,
  });
  res.json({ summary: summary || "Nothing important happened.", count: messages.length });
};

export const smartReplies = async (req, res) => {
  const conv = await getConversationForMember(req.data.conversationId, req.user._id, { lean: true });
  const member = getMember(conv, req.user._id);
  const messages = await Message.find({
    conversation: conv._id,
    hiddenFor: { $ne: toObjectId(req.user._id) },
    createdAt: { $gt: visibleSince(conv, member) },
    type: "user",
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .limit(16)
    .lean();

  const last = messages[0];
  if (!last || sameId(last.sender, req.user._id)) return res.json({ replies: [] });

  await consumeQuota(req.user._id);
  const meName = req.user.fullName.split(" ")[0];
  const transcript = await buildTranscript(messages.reverse(), req.user, 5000);
  const raw = await complete({
    system:
      `You suggest quick replies in a chat app. Write 3 short, natural replies that ${meName} could send next, ` +
      "responding to the latest message from the other person. Make them meaningfully different (for example: agree, ask a follow-up, politely decline) when that fits. " +
      "Match the conversation's language, tone and formality; use emojis only if the conversation does. Each reply must be under 60 characters. " +
      'Respond with JSON only, exactly like {"replies": ["...", "...", "..."]}.',
    prompt: `Conversation (oldest first):\n${transcript}`,
    maxTokens: 1200,
    temperature: 0.7,
  });

  const parsed = parseJsonLoose(raw);
  const replies = (Array.isArray(parsed?.replies) ? parsed.replies : [])
    .map((r) => truncate(String(r || "").replace(/^["']|["']$/g, ""), 80))
    .filter(Boolean)
    .slice(0, 3);
  res.json({ replies });
};

const REWRITE_INSTRUCTIONS = {
  fix: "Fix spelling, grammar and punctuation. Keep the meaning, tone, language and formatting. Change as little as possible.",
  friendly: "Rewrite it to sound warmer and friendlier while keeping the meaning.",
  professional: "Rewrite it to sound clear, polite and professional.",
  concise: "Make it shorter and clearer without losing important information.",
  expand: "Expand it slightly with a bit more detail and clarity, keeping the same intent.",
  emoji: "Add a few fitting emojis without changing the wording much.",
};

export const rewrite = async (req, res) => {
  const { text, style } = req.data;
  await consumeQuota(req.user._id);
  const result = await complete({
    system:
      `You rewrite chat messages for the sender. ${REWRITE_INSTRUCTIONS[style]} ` +
      "Keep the same language as the original. Reply with only the rewritten message: no quotes, labels or explanations.",
    prompt: text,
    maxTokens: 2000,
    temperature: style === "fix" ? 0.1 : 0.6,
  });
  res.json({ text: result.replace(/^["“]|["”]$/g, "").trim() || text });
};

/**
 * Translates either free text (composer) or a batch of messages (one
 * request for up to 30). Results are cached on each message per language,
 * so a chat only ever pays for a translation once.
 */
export const translate = async (req, res) => {
  const { messageIds, text, lang } = req.data;
  // Used inside a Mongo field path, so keep it to [a-z0-9-].
  const langKey = lang.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "en";
  const target = languageName(lang);

  if (!messageIds?.length) {
    await consumeQuota(req.user._id);
    const out = await complete({
      system: `Translate the user's chat message into ${target}. Preserve meaning, tone, emojis, names and links. Reply with only the translation.`,
      prompt: text,
      maxTokens: 2000,
      temperature: 0.2,
    });
    return res.json({ text: out || text });
  }

  const messages = await Message.find({ _id: { $in: uniqueIds(messageIds) }, deletedAt: null, type: "user" }).lean();
  const convIds = uniqueIds(messages.map((m) => m.conversation));
  const allowed = await Conversation.countDocuments({ _id: { $in: convIds }, "members.user": req.user._id });
  if (allowed !== convIds.length) throw notFound("Message not found");

  const translations = {};
  const pending = [];
  for (const m of messages) {
    const cached = m.translations?.[langKey];
    if (cached !== undefined) translations[idStr(m._id)] = cached === "__same__" ? { same: true } : { text: cached };
    else if (m.text?.trim()) pending.push(m);
  }

  if (pending.length) {
    await consumeQuota(req.user._id);
    const items = pending.map((m) => ({ id: idStr(m._id), text: truncate(m.text, 1500) }));
    const raw = await complete({
      system:
        `You translate chat messages into ${target}. Translate each item's text naturally, preserving meaning, tone, emojis, names, links and line breaks. ` +
        `If an item is already written in ${target}, set "same" to true and copy the text unchanged. ` +
        'Respond with JSON only, exactly like {"items": [{"id": "...", "text": "...", "same": false}]}.',
      prompt: JSON.stringify({ items }),
      maxTokens: 4000,
      temperature: 0.2,
    });
    const parsed = parseJsonLoose(raw);
    const results = Array.isArray(parsed?.items) ? parsed.items : [];
    const writes = [];
    for (const item of results) {
      const id = String(item?.id || "");
      if (!pending.some((m) => idStr(m._id) === id)) continue;
      const same = item.same === true;
      const value = same ? "__same__" : truncate(String(item.text || ""), 4000);
      if (!same && !value) continue;
      translations[id] = same ? { same: true } : { text: value };
      writes.push(Message.updateOne({ _id: id }, { $set: { [`translations.${langKey}`]: value } }));
    }
    await Promise.all(writes);
  }

  res.json({ translations });
};

export const transcribe = async (req, res) => {
  const { message, conv } = await getMessageForMember(req.data.messageId, req.user._id);
  const audio = message.attachments.find((a) => a.kind === "audio");
  if (!audio || message.deletedAt) throw badRequest("This message has no audio to transcribe");
  if (message.transcript) return res.json({ transcript: message.transcript });
  if (audio.size > 20 * 1024 * 1024) throw badRequest("This recording is too long to transcribe");

  await consumeQuota(req.user._id);
  const buffer = await readStoredFile(audio);
  const transcript = (await transcribeAudio(buffer, audio.mime)) || "(no speech detected)";
  message.transcript = transcript;
  await message.save();
  broadcastMessageUpdate(conv, message);
  res.json({ transcript });
};
