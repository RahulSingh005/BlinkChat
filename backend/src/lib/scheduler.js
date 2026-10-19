import Conversation from "../models/conversation.model.js";
import Reminder from "../models/reminder.model.js";
import ScheduledMessage from "../models/scheduledMessage.model.js";
import { emitToUser } from "./realtime.js";
import { sendPushToUser } from "./push.js";
import { serializeMessage } from "./serializers.js";
import { idStr, truncate } from "./utils.js";
import { assertCanSend, createMessage } from "../services/message.service.js";
import { serializeReminder } from "../controllers/reminder.controller.js";
import { sweepExpiredStories } from "../controllers/story.controller.js";

/**
 * Delivers scheduled messages and fires reminders. Jobs are claimed with an
 * atomic findOneAndUpdate (lockedAt), so this is safe with several server
 * instances and survives restarts (state lives in MongoDB).
 *
 * Hosting note: on free tiers that sleep when idle, jobs run when the server
 * wakes up. Point a free uptime pinger at /api/health to keep it awake.
 */
const TICK_MS = 5000;
const LOCK_TIMEOUT_MS = 60 * 1000;
const MAX_ATTEMPTS = 3;
const BATCH = 25;

const STORY_SWEEP_MS = 5 * 60 * 1000;

let timer = null;
let running = false;
let lastStorySweep = 0;

const claim = (Model, timeField, extra = {}) =>
  Model.findOneAndUpdate(
    {
      status: "pending",
      [timeField]: { $lte: new Date() },
      $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(Date.now() - LOCK_TIMEOUT_MS) } }],
      ...extra,
    },
    { $set: { lockedAt: new Date() } },
    { sort: { [timeField]: 1 }, new: true }
  );

async function deliverScheduled(item) {
  try {
    const conv = await Conversation.findOne({ _id: item.conversation, "members.user": item.sender });
    if (!conv) throw new Error("You are no longer part of this chat");
    await assertCanSend(conv, item.sender);
    const { message } = await createMessage({
      conversation: conv,
      senderId: item.sender,
      text: item.text,
      attachments: item.attachments || [],
      replyTo: item.replyTo,
      urgent: item.urgent,
      scheduled: true,
      clientId: `sched-${idStr(item._id)}`,
    });
    item.status = "sent";
    item.message = message._id;
    item.lockedAt = null;
    await item.save();
    emitToUser(item.sender, "scheduled:sent", {
      scheduledId: idStr(item._id),
      conversationId: idStr(item.conversation),
      message: serializeMessage(message),
    });
  } catch (err) {
    item.attempts += 1;
    item.error = truncate(err.message || "Failed to send", 200);
    item.lockedAt = null;
    if (item.attempts >= MAX_ATTEMPTS || err.status) item.status = "failed";
    await item.save();
    if (item.status === "failed") {
      emitToUser(item.sender, "scheduled:failed", {
        scheduledId: idStr(item._id),
        conversationId: idStr(item.conversation),
        error: item.error,
      });
    }
  }
}

async function fireReminder(reminder) {
  reminder.status = "fired";
  reminder.firedAt = new Date();
  reminder.lockedAt = null;
  await reminder.save();
  const payload = serializeReminder(reminder.toObject());
  emitToUser(reminder.user, "reminder:due", { reminder: payload });
  await sendPushToUser(
    reminder.user,
    {
      type: "reminder",
      title: `⏰ Reminder${reminder.preview?.senderName ? ` · ${reminder.preview.senderName}` : ""}`,
      body: truncate(reminder.note || reminder.preview?.text || "You asked to be reminded about a message", 180),
      tag: `reminder-${idStr(reminder._id)}`,
      url: `/chat/${idStr(reminder.conversation)}?message=${idStr(reminder.message)}`,
      conversationId: idStr(reminder.conversation),
      requireInteraction: true,
    },
    { ttl: 24 * 3600 }
  );
}

export async function runSchedulerOnce() {
  if (running) return;
  running = true;
  try {
    for (let i = 0; i < BATCH; i += 1) {
      const item = await claim(ScheduledMessage, "sendAt");
      if (!item) break;
      await deliverScheduled(item);
    }
    for (let i = 0; i < BATCH; i += 1) {
      const reminder = await claim(Reminder, "remindAt");
      if (!reminder) break;
      await fireReminder(reminder).catch((err) => console.warn("[scheduler] reminder failed:", err.message));
    }
    if (Date.now() - lastStorySweep > STORY_SWEEP_MS) {
      lastStorySweep = Date.now();
      await sweepExpiredStories();
    }
  } catch (err) {
    console.warn("[scheduler] tick failed:", err.message);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (timer) return;
  const tick = async () => {
    await runSchedulerOnce();
    timer = setTimeout(tick, TICK_MS);
  };
  timer = setTimeout(tick, 1500);
}

export function stopScheduler() {
  clearTimeout(timer);
  timer = null;
}
