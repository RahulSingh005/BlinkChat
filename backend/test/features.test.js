import { client, connectSocket, createUser, emitAck, getBaseUrl, resetDb, setup, sleep, teardown, waitFor } from "./helpers.js";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Conversation from "../src/models/conversation.model.js";
import Message from "../src/models/message.model.js";
import Reminder from "../src/models/reminder.model.js";
import ScheduledMessage from "../src/models/scheduledMessage.model.js";
import { runSchedulerOnce } from "../src/lib/scheduler.js";
import { runMigrations } from "../src/migrations/index.js";

const OFFER = { type: "offer", sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n" };
const ANSWER = { type: "answer", sdp: "v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\ns=-\r\n" };

const pair = async () => {
  const a = await createUser("Alice");
  const b = await createUser("Bob");
  const conv = (await a.post("/api/conversations/direct").send({ userId: b.user._id })).body.conversation;
  return { a, b, conv };
};

describe("calls (signaling)", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  it("rings every callee device, buffers early ICE candidates, and logs the call", async () => {
    const { a, b, conv } = await pair();
    const aSock = await connectSocket(a.cookie);
    const bPhone = await connectSocket(b.cookie);
    const bLaptop = await connectSocket(b.cookie);

    const ringPhone = waitFor(bPhone, "call:incoming");
    const ringLaptop = waitFor(bLaptop, "call:incoming");
    const start = await emitAck(aSock, "call:start", { conversationId: conv._id, type: "video", offer: OFFER });
    assert.equal(start.ok, true, JSON.stringify(start));
    const incoming = await ringPhone;
    await ringLaptop;
    assert.equal(incoming.from._id, a.user._id);
    assert.equal(incoming.offer.sdp, OFFER.sdp);

    // Caller candidates sent while ringing used to be dropped.
    aSock.emit("call:signal", { callId: start.callId, candidate: { candidate: "candidate:1 1 udp 1 1.2.3.4 9 typ host", sdpMid: "0" } });
    await sleep(50);

    const accepted = waitFor(aSock, "call:accepted");
    const taken = waitFor(bLaptop, "call:taken");
    const flushed = waitFor(bPhone, "call:signal");
    const res = await emitAck(bPhone, "call:accept", { callId: start.callId, answer: ANSWER });
    assert.equal(res.ok, true);
    assert.equal((await accepted).answer.sdp, ANSWER.sdp);
    await taken;
    assert.match((await flushed).candidate.candidate, /1\.2\.3\.4/);

    const media = waitFor(aSock, "call:media");
    bPhone.emit("call:media", { callId: start.callId, audio: false, video: true });
    assert.equal((await media).audio, false);

    const ended = waitFor(bPhone, "call:ended");
    aSock.emit("call:end", { callId: start.callId });
    assert.equal((await ended).reason, "hangup");
    await sleep(200);
    const log = await Message.findOne({ conversation: conv._id, type: "call" }).lean();
    assert.equal(log.call.status, "completed");
    assert.equal(log.call.kind, "video");
  });

  it("logs a missed call when the callee is offline, and a decline", async () => {
    const { a, b, conv } = await pair();
    const aSock = await connectSocket(a.cookie);
    const offline = await emitAck(aSock, "call:start", { conversationId: conv._id, type: "voice", offer: OFFER });
    assert.deepEqual(offline, { ok: false, reason: "offline" });
    await sleep(150);
    const missed = await Message.findOne({ conversation: conv._id, type: "call" }).lean();
    assert.equal(missed.call.status, "unavailable");
    const bConv = (await b.get(`/api/conversations/${conv._id}`)).body.conversation;
    assert.equal(bConv.me.unreadCount, 1, "missed call counts as unread");

    const bSock = await connectSocket(b.cookie);
    const ring = waitFor(bSock, "call:incoming");
    const start = await emitAck(aSock, "call:start", { conversationId: conv._id, type: "voice", offer: OFFER });
    await ring;
    const declined = waitFor(aSock, "call:declined");
    bSock.emit("call:decline", { callId: start.callId });
    await declined;
    await sleep(150);
    const statuses = (await Message.find({ conversation: conv._id, type: "call" }).sort({ createdAt: 1 }).lean()).map((m) => m.call.status);
    assert.deepEqual(statuses, ["unavailable", "declined"]);
  });

  it("refuses calls in groups and between blocked users", async () => {
    const { a, b, conv } = await pair();
    const aSock = await connectSocket(a.cookie);
    await connectSocket(b.cookie);
    await b.put(`/api/users/${a.user._id}/block`);
    const blocked = await emitAck(aSock, "call:start", { conversationId: conv._id, type: "voice", offer: OFFER });
    assert.deepEqual(blocked, { ok: false, reason: "blocked" });

    // (Bob blocked Alice, so he can't be added to her group — use Cara.)
    const c = await createUser("Cara");
    assert.equal((await a.post("/api/conversations/group").send({ name: "G", memberIds: [b.user._id] })).status, 400);
    const group = (await a.post("/api/conversations/group").send({ name: "G", memberIds: [c.user._id] })).body.conversation;
    const res = await emitAck(aSock, "call:start", { conversationId: group._id, type: "voice", offer: OFFER });
    assert.deepEqual(res, { ok: false, reason: "group_unsupported" });
  });

  it("serves ICE servers (STUN at minimum) to signed-in users", async () => {
    const { a } = await pair();
    const res = await a.get("/api/calls/ice-servers");
    assert.equal(res.status, 200);
    assert.ok(res.body.iceServers.length >= 1);
    assert.equal((await client().get("/api/calls/ice-servers")).status, 401);
  });
});

describe("scheduled messages & reminders", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  it("validates, lists, cancels and delivers scheduled messages", async () => {
    const { a, b, conv } = await pair();
    const tooSoon = await a.post(`/api/conversations/${conv._id}/scheduled`).send({ text: "hi", sendAt: new Date().toISOString() });
    assert.equal(tooSoon.status, 400);

    const later = new Date(Date.now() + 3600e3).toISOString();
    const created = await a.post(`/api/conversations/${conv._id}/scheduled`).send({ text: "Good morning! ☀️", sendAt: later });
    assert.equal(created.status, 201);
    const list = (await a.get(`/api/conversations/${conv._id}/scheduled`)).body.scheduled;
    assert.equal(list.length, 1);
    assert.equal((await b.get(`/api/conversations/${conv._id}/scheduled`)).body.scheduled.length, 0, "only the sender sees them");

    // Make it due now and run the scheduler.
    await ScheduledMessage.updateOne({ _id: created.body.scheduled._id }, { $set: { sendAt: new Date(Date.now() - 1000) } });
    const bSock = await connectSocket(b.cookie);
    const aSock = await connectSocket(a.cookie);
    const got = waitFor(bSock, "message:new");
    const sent = waitFor(aSock, "scheduled:sent");
    await runSchedulerOnce();
    const { message } = await got;
    assert.equal(message.text, "Good morning! ☀️");
    assert.equal(message.scheduled, true);
    await sent;
    await runSchedulerOnce();
    assert.equal(await Message.countDocuments({ conversation: conv._id }), 1, "delivered exactly once");

    const another = await a.post(`/api/conversations/${conv._id}/scheduled`).send({ text: "nope", sendAt: later });
    assert.equal((await a.delete(`/api/scheduled/${another.body.scheduled._id}`)).status, 200);
    assert.equal((await b.delete(`/api/scheduled/${another.body.scheduled._id}`)).status, 404);
  });

  it("fails a scheduled message if the recipient blocked the sender", async () => {
    const { a, b, conv } = await pair();
    const created = await a.post(`/api/conversations/${conv._id}/scheduled`).send({ text: "hi", sendAt: new Date(Date.now() + 3600e3).toISOString() });
    await b.put(`/api/users/${a.user._id}/block`);
    await ScheduledMessage.updateOne({ _id: created.body.scheduled._id }, { $set: { sendAt: new Date(Date.now() - 1000) } });
    await runSchedulerOnce();
    const item = await ScheduledMessage.findById(created.body.scheduled._id).lean();
    assert.equal(item.status, "failed");
    assert.equal(await Message.countDocuments({ conversation: conv._id }), 0);
  });

  it("fires message reminders over the socket", async () => {
    const { a, b, conv } = await pair();
    const msg = (await b.post(`/api/conversations/${conv._id}/messages`).send({ text: "Send me the report by Friday" })).body.message;
    const res = await a.post(`/api/messages/${msg._id}/remind`).send({ remindAt: new Date(Date.now() + 3600e3).toISOString(), note: "Report!" });
    assert.equal(res.status, 201);
    assert.equal(res.body.reminder.preview.senderName, "Bob");
    assert.equal((await a.get("/api/reminders")).body.reminders.length, 1);

    await Reminder.updateOne({ _id: res.body.reminder._id }, { $set: { remindAt: new Date(Date.now() - 1000) } });
    const aSock = await connectSocket(a.cookie);
    const due = waitFor(aSock, "reminder:due");
    await runSchedulerOnce();
    const { reminder } = await due;
    assert.equal(reminder.note, "Report!");
    assert.equal(reminder.status, "fired");

    const done = await a.patch(`/api/reminders/${reminder._id}`).send({ done: true });
    assert.equal(done.body.reminder.status, "done");
  });
});

describe("uploads, config & migration", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  // 1x1 transparent PNG
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64"
  );

  it("stores uploads locally, serves them safely and only accepts our own URLs", async () => {
    const { a, conv } = await pair();
    const up = await a.post("/api/uploads").field("purpose", "message").field("width", "1").field("height", "1").attach("file", PNG, { filename: "dot.png", contentType: "image/png" });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    const att = up.body.attachment;
    assert.equal(att.kind, "image");
    assert.match(att.url, /^\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{32}\.png$/);

    const file = await client().get(att.url);
    assert.equal(file.status, 200);
    assert.equal(file.headers["x-content-type-options"], "nosniff");

    const msg = await a.post(`/api/conversations/${conv._id}/messages`).send({ text: "", attachments: [att] });
    assert.equal(msg.status, 201);
    assert.equal(msg.body.message.attachments[0].url, att.url);

    const forged = await a.post(`/api/conversations/${conv._id}/messages`).send({ attachments: [{ ...att, url: "https://evil.example.com/x.png" }] });
    assert.equal(forged.status, 400);

    const html = await a.post("/api/uploads").attach("file", Buffer.from("<script>alert(1)</script>"), { filename: "x.html", contentType: "text/html" });
    assert.equal(html.status, 400);
    const pdf = await a.post("/api/uploads").attach("file", Buffer.from("%PDF-1.4 test"), { filename: "Résumé final.pdf", contentType: "application/pdf" });
    assert.equal(pdf.status, 201);
    assert.equal(pdf.body.attachment.name, "Résumé final.pdf", "non-ASCII names survive");
    const pdfFile = await client().get(pdf.body.attachment.url);
    assert.equal(pdfFile.headers["content-disposition"], "attachment");
  });

  it("exposes runtime config and health", async () => {
    const cfg = await client().get("/api/config");
    assert.equal(cfg.status, 200);
    assert.equal(typeof cfg.body.features.ai.enabled, "boolean");
    assert.equal(cfg.body.features.storage, "local");
    const health = await client().get("/api/health");
    assert.equal(health.body.db, "up");
    const unknown = await client().get("/api/does-not-exist");
    assert.equal(unknown.status, 404);
  });

  it("AI endpoints fail gracefully when no provider is configured", async () => {
    const { a, conv } = await pair();
    const status = await a.get("/api/ai/status");
    assert.equal(status.body.enabled, false);
    const res = await a.post("/api/ai/rewrite").send({ text: "helo wrld", style: "fix" });
    assert.equal(res.status, 503);
    const sum = await a.post("/api/ai/summarize").send({ conversationId: conv._id });
    assert.equal(sum.status, 200, "too few messages short-circuits before calling AI");
  });

  it("migrates v1 messages (senderId/receiverId/image) into conversations", async () => {
    const { a, b } = await pair();
    await Conversation.deleteMany({});
    const db = mongoose.connection.db;
    const t0 = new Date(Date.now() - 60000);
    await db.collection("messages").insertMany([
      { senderId: new mongoose.Types.ObjectId(a.user._id), receiverId: new mongoose.Types.ObjectId(b.user._id), text: "old hello", createdAt: t0, updatedAt: t0 },
      { senderId: new mongoose.Types.ObjectId(b.user._id), receiverId: new mongoose.Types.ObjectId(a.user._id), text: "", image: "https://res.cloudinary.com/demo/image/upload/x.jpg", createdAt: new Date(t0.getTime() + 1000), updatedAt: t0 },
    ]);
    await db.collection("migrations").deleteMany({});
    await runMigrations();

    const list = (await a.get("/api/conversations")).body.conversations;
    assert.equal(list.length, 1);
    assert.equal(list[0].me.unreadCount, 0);
    const msgs = (await a.get(`/api/conversations/${list[0]._id}/messages`)).body.messages;
    assert.deepEqual(msgs.map((m) => m.text), ["old hello", ""]);
    assert.equal(msgs[1].attachments[0].kind, "image");
    assert.equal(await db.collection("messages").countDocuments({ senderId: { $exists: true } }), 0);

    await runMigrations(); // idempotent
    assert.equal(await Conversation.countDocuments(), 1);
    assert.ok(getBaseUrl());
  });
});
