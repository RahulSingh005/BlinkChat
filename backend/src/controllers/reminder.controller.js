import Reminder from "../models/reminder.model.js";
import ScheduledMessage from "../models/scheduledMessage.model.js";
import { badRequest, notFound } from "../lib/errors.js";
import { emitToUser } from "../lib/realtime.js";
import { idStr, isObjectId } from "../lib/utils.js";

export const serializeReminder = (r) => ({
  _id: idStr(r._id),
  conversation: idStr(r.conversation),
  message: idStr(r.message),
  remindAt: r.remindAt,
  note: r.note || "",
  preview: r.preview || { text: "", senderName: "" },
  status: r.status,
  firedAt: r.firedAt || null,
  createdAt: r.createdAt,
});

export const listReminders = async (req, res) => {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const items = await Reminder.find({
    user: req.user._id,
    $or: [{ status: "pending" }, { status: "fired", firedAt: { $gte: since } }],
  })
    .sort({ remindAt: 1 })
    .limit(200)
    .lean();
  res.json({ reminders: items.map(serializeReminder) });
};

const ownReminder = async (req) => {
  if (!isObjectId(req.params.id)) throw notFound("Reminder not found");
  const reminder = await Reminder.findOne({ _id: req.params.id, user: req.user._id });
  if (!reminder) throw notFound("Reminder not found");
  return reminder;
};

/** Mark done, or snooze with a new remindAt. */
export const updateReminder = async (req, res) => {
  const reminder = await ownReminder(req);
  if (req.body?.done === true) {
    reminder.status = "done";
  } else if (req.body?.remindAt) {
    const at = new Date(req.body.remindAt);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 30 * 1000) throw badRequest("Pick a time at least a minute from now");
    reminder.remindAt = at;
    reminder.status = "pending";
    reminder.lockedAt = null;
    reminder.firedAt = null;
  } else {
    throw badRequest("Nothing to update");
  }
  await reminder.save();
  emitToUser(req.user._id, "reminders:changed", {});
  res.json({ reminder: serializeReminder(reminder.toObject()) });
};

export const deleteReminder = async (req, res) => {
  const reminder = await ownReminder(req);
  reminder.status = "canceled";
  await reminder.save();
  emitToUser(req.user._id, "reminders:changed", {});
  res.json({ canceled: true });
};

// ---- Scheduled message actions --------------------------------------------

const ownScheduled = async (req) => {
  if (!isObjectId(req.params.id)) throw notFound("Scheduled message not found");
  const item = await ScheduledMessage.findOne({ _id: req.params.id, sender: req.user._id });
  if (!item) throw notFound("Scheduled message not found");
  return item;
};

export const cancelScheduled = async (req, res) => {
  const item = await ownScheduled(req);
  if (item.status === "sent") throw badRequest("This message was already sent");
  item.status = "canceled";
  await item.save();
  emitToUser(req.user._id, "scheduled:changed", { conversationId: idStr(item.conversation) });
  res.json({ canceled: true });
};

/** Reschedule, or `{ sendNow: true }` to deliver immediately. */
export const rescheduleScheduled = async (req, res) => {
  const item = await ownScheduled(req);
  if (!["pending", "failed"].includes(item.status)) throw badRequest("This message can't be changed anymore");
  if (req.body?.sendNow === true) {
    item.sendAt = new Date();
  } else {
    const at = new Date(req.body?.sendAt);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 30 * 1000) throw badRequest("Pick a time at least a minute from now");
    item.sendAt = at;
  }
  item.status = "pending";
  item.lockedAt = null;
  item.attempts = 0;
  item.error = "";
  await item.save();
  emitToUser(req.user._id, "scheduled:changed", { conversationId: idStr(item.conversation) });
  res.json({ rescheduled: true, sendAt: item.sendAt });
};
