import { connectSocket, createUser, getBaseUrl, resetDb, setup, sleep, teardown, waitFor } from "./helpers.js";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import Message from "../src/models/message.model.js";

const openDirect = async (a, b) => {
  const res = await a.post("/api/conversations/direct").send({ userId: b.user._id });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.conversation;
};

const send = async (u, convId, body) => {
  const res = await u.post(`/api/conversations/${convId}/messages`).send(typeof body === "string" ? { text: body } : body);
  assert.ok([200, 201].includes(res.status), JSON.stringify(res.body));
  return res.body.message;
};

describe("direct chats", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  it("creates exactly one direct conversation per pair (even concurrently)", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const [c1, c2, c3] = await Promise.all([openDirect(a, b), openDirect(a, b), openDirect(b, a)]);
    assert.equal(c1._id, c2._id);
    assert.equal(c1._id, c3._id);
    assert.equal(c1.type, "direct");
    assert.equal(c1.peerId, b.user._id);
    // Opening a chat with yourself gives you "Saved Messages".
    const self = await a.post("/api/conversations/direct").send({ userId: a.user._id });
    assert.equal(self.status, 200);
    assert.equal(self.body.conversation.type, "self");
  });

  it("hides an empty chat from the other person until the first message", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    assert.equal((await b.get("/api/conversations")).body.conversations.length, 0);
    assert.equal((await a.get("/api/conversations")).body.conversations.length, 1);
    await send(a, conv._id, "hi");
    const list = (await b.get("/api/conversations")).body.conversations;
    assert.equal(list.length, 1);
    assert.equal(list[0].lastMessage.text, "hi");
    assert.equal(list[0].me.unreadCount, 1);
  });

  it("delivers messages in realtime to every device and tracks delivery/read receipts", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    const aSock = await connectSocket(a.cookie);
    const bPhone = await connectSocket(b.cookie);
    const bLaptop = await connectSocket(b.cookie);

    const gotPhone = waitFor(bPhone, "message:new");
    const gotLaptop = waitFor(bLaptop, "message:new");
    const delivered = waitFor(aSock, "conversation:delivered");
    const msg = await send(a, conv._id, { text: "Hello Bob", clientId: "client-abc-123" });
    assert.equal((await gotPhone).message._id, msg._id);
    assert.equal((await gotLaptop).message.text, "Hello Bob");
    assert.deepEqual((await delivered).userIds, [b.user._id]);

    // Retrying with the same clientId is idempotent.
    const retry = await a.post(`/api/conversations/${conv._id}/messages`).send({ text: "Hello Bob", clientId: "client-abc-123" });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.message._id, msg._id);
    assert.equal(await Message.countDocuments({ conversation: conv._id }), 1);

    const read = waitFor(aSock, "conversation:read");
    const readSelf = waitFor(bLaptop, "conversation:read", (p) => p.self);
    await b.post(`/api/conversations/${conv._id}/read`);
    assert.equal((await read).userId, b.user._id);
    await readSelf;
    const bList = (await b.get("/api/conversations")).body.conversations;
    assert.equal(bList[0].me.unreadCount, 0);
  });

  it("does not send read receipts when the reader turned them off", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    await b.put("/api/auth/profile").send({ settings: { readReceipts: false } });
    const conv = await openDirect(a, b);
    await send(a, conv._id, "ping");
    const aSock = await connectSocket(a.cookie);
    let gotRead = false;
    aSock.on("conversation:read", () => (gotRead = true));
    const delivered = waitFor(aSock, "conversation:delivered");
    await b.post(`/api/conversations/${conv._id}/read`);
    await delivered;
    await sleep(150);
    assert.equal(gotRead, false);
    const view = (await a.get(`/api/conversations/${conv._id}`)).body.conversation;
    const bMember = view.members.find((m) => m.user._id === b.user._id);
    assert.equal(bMember.lastReadAt, null, "read time is masked");
  });

  it("supports replies, edits, reactions and both kinds of delete", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    const first = await send(a, conv._id, "Lunch at 1?");
    const reply = await send(b, conv._id, { text: "Sure!", replyTo: first._id });
    assert.equal(reply.replyTo.message, first._id);
    assert.equal(reply.replyTo.text, "Lunch at 1?");

    const bSock = await connectSocket(b.cookie);
    const updated = waitFor(bSock, "message:updated");
    const edit = await a.patch(`/api/messages/${first._id}`).send({ text: "Lunch at 1:30?" });
    assert.equal(edit.status, 200);
    assert.ok(edit.body.message.editedAt);
    assert.equal((await updated).message.text, "Lunch at 1:30?");
    assert.equal((await b.patch(`/api/messages/${first._id}`).send({ text: "hacked" })).status, 403);

    const r1 = await b.post(`/api/messages/${first._id}/react`).send({ emoji: "👍" });
    assert.deepEqual(r1.body.message.reactions, [{ user: b.user._id, emoji: "👍" }]);
    const r2 = await b.post(`/api/messages/${first._id}/react`).send({ emoji: "❤️" });
    assert.deepEqual(r2.body.message.reactions.map((r) => r.emoji), ["❤️"], "one reaction per person");
    const r3 = await b.post(`/api/messages/${first._id}/react`).send({ emoji: "❤️" });
    assert.equal(r3.body.message.reactions.length, 0, "same emoji toggles off");

    // Delete for me: only hidden for Bob.
    await b.delete(`/api/messages/${reply._id}?scope=me`);
    const bMsgs = (await b.get(`/api/conversations/${conv._id}/messages`)).body.messages;
    const aMsgs = (await a.get(`/api/conversations/${conv._id}/messages`)).body.messages;
    assert.equal(bMsgs.length, 1);
    assert.equal(aMsgs.length, 2);

    // Delete for everyone: only the sender, leaves a tombstone.
    assert.equal((await b.delete(`/api/messages/${first._id}?scope=everyone`)).status, 403);
    const del = await a.delete(`/api/messages/${first._id}?scope=everyone`);
    assert.equal(del.status, 200);
    assert.ok(del.body.message.deletedAt);
    assert.equal(del.body.message.text, "");
  });

  it("clear chat only affects the person who cleared it", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    await send(a, conv._id, "one");
    await send(b, conv._id, "two");
    await a.post(`/api/conversations/${conv._id}/clear`);
    assert.equal((await a.get(`/api/conversations/${conv._id}/messages`)).body.messages.length, 0);
    assert.equal((await b.get(`/api/conversations/${conv._id}/messages`)).body.messages.length, 2);
    await send(b, conv._id, "three");
    const after = (await a.get(`/api/conversations/${conv._id}/messages`)).body.messages;
    assert.deepEqual(after.map((m) => m.text), ["three"]);
  });

  it("blocking stops messages in both directions and hides profile details", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    await b.put("/api/auth/profile").send({ about: "secret about" });
    const conv = await openDirect(a, b);
    await send(a, conv._id, "hey");

    const block = await a.put(`/api/users/${b.user._id}/block`);
    assert.equal(block.body.blocked, true);
    assert.equal((await a.post(`/api/conversations/${conv._id}/messages`).send({ text: "x" })).status, 403);
    assert.equal((await b.post(`/api/conversations/${conv._id}/messages`).send({ text: "x" })).status, 403);

    await a.put("/api/auth/profile").send({ about: "alice about" });
    const bView = (await b.get(`/api/users/${a.user._id}`)).body.user;
    assert.equal(bView.about, "", "blocked user can't see the blocker's about");
    assert.equal(bView.lastSeen, null);

    const unblock = await a.put(`/api/users/${b.user._id}/block`);
    assert.equal(unblock.body.blocked, false);
    await send(a, conv._id, "back");
  });

  it("paginates with cursors and finds messages by search and around", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    const docs = Array.from({ length: 95 }, (_, i) => ({
      conversation: conv._id,
      sender: i % 2 ? a.user._id : b.user._id,
      text: i === 10 ? "the secret pineapple" : `message ${i}`,
      createdAt: new Date(Date.now() - (95 - i) * 1000),
    }));
    await Message.insertMany(docs);

    const page1 = (await a.get(`/api/conversations/${conv._id}/messages?limit=40`)).body;
    assert.equal(page1.messages.length, 40);
    assert.equal(page1.hasMore, true);
    assert.equal(page1.messages.at(-1).text, "message 94", "ascending order, newest last");
    const page2 = (await a.get(`/api/conversations/${conv._id}/messages?limit=40&before=${page1.messages[0]._id}`)).body;
    const page3 = (await a.get(`/api/conversations/${conv._id}/messages?limit=40&before=${page2.messages[0]._id}`)).body;
    assert.equal(page3.messages.length, 15);
    assert.equal(page3.hasMore, false);
    const all = [...page3.messages, ...page2.messages, ...page1.messages];
    assert.equal(new Set(all.map((m) => m._id)).size, 95, "no duplicates or gaps");

    const found = (await a.get(`/api/conversations/${conv._id}/messages/search?q=PINEAPPLE`)).body.messages;
    assert.equal(found.length, 1);
    const around = (await a.get(`/api/conversations/${conv._id}/messages?around=${found[0]._id}&limit=20`)).body;
    assert.ok(around.messages.some((m) => m._id === found[0]._id));
    assert.equal(around.hasNewer, true);
    const regexSafe = await a.get(`/api/conversations/${conv._id}/messages/search?q=${encodeURIComponent("(a+)+$")}`);
    assert.equal(regexSafe.status, 200);
  });

  it("supports mute, pin, archive and delete chat for one side", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    await send(b, conv._id, "hello");
    const settings = await a.patch(`/api/conversations/${conv._id}/settings`).send({ muteFor: 3600, pinned: true, archived: true });
    assert.equal(settings.status, 200);
    assert.ok(settings.body.me.mutedUntil);
    assert.ok(settings.body.me.pinnedAt);
    assert.equal(settings.body.me.archived, true);

    await a.delete(`/api/conversations/${conv._id}`);
    assert.equal((await a.get("/api/conversations")).body.conversations.length, 0);
    assert.equal((await b.get("/api/conversations")).body.conversations.length, 1);
    await send(b, conv._id, "you there?");
    const back = (await a.get("/api/conversations")).body.conversations;
    assert.equal(back.length, 1, "new message brings the chat back");
    assert.equal(back[0].lastMessage.text, "you there?");
  });

  it("enforces membership on every conversation endpoint", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const eve = await createUser("Eve");
    const conv = await openDirect(a, b);
    const msg = await send(a, conv._id, "private");
    assert.equal((await eve.get(`/api/conversations/${conv._id}/messages`)).status, 404);
    assert.equal((await eve.post(`/api/conversations/${conv._id}/messages`).send({ text: "x" })).status, 404);
    assert.equal((await eve.post(`/api/messages/${msg._id}/react`).send({ emoji: "👍" })).status, 404);
    assert.equal((await eve.delete(`/api/messages/${msg._id}?scope=everyone`)).status, 404);
    assert.equal((await eve.get("/api/conversations/not-an-id")).status, 404);
  });

  it("broadcasts typing only to members and presence to contacts", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const eve = await createUser("Eve");
    const conv = await openDirect(a, b);
    await send(a, conv._id, "hi");
    const bSock = await connectSocket(b.cookie);
    const eveSock = await connectSocket(eve.cookie);
    let eveSaw = false;
    eveSock.on("typing", () => (eveSaw = true));

    const online = waitFor(bSock, "presence", (p) => p.userId === a.user._id && p.online);
    const aSock = await connectSocket(a.cookie);
    await online;
    const typing = waitFor(bSock, "typing");
    aSock.emit("typing", { conversationId: conv._id, isTyping: true });
    const t = await typing;
    assert.equal(t.userId, a.user._id);
    await sleep(100);
    assert.equal(eveSaw, false);
  });

  it("rejects sockets without a valid session or from foreign origins", async () => {
    await assert.rejects(connectSocket("jwt=nope"));
    const a = await createUser("Alice");
    const { io: ioClient } = await import("socket.io-client");
    const evil = await new Promise((resolve) => {
      const s = ioClient(getBaseUrl(), {
        transports: ["websocket"],
        extraHeaders: { Cookie: a.cookie, Origin: "https://evil.example.com" },
        reconnection: false,
        forceNew: true,
      });
      s.on("connect", () => resolve("connected"));
      s.on("connect_error", () => resolve("rejected"));
    });
    assert.equal(evil, "rejected");
  });
});

describe("groups", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  it("creates a group, posts system messages and fans out to members", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const c = await createUser("Cara");
    const bSock = await connectSocket(b.cookie);
    const created = waitFor(bSock, "conversation:new");
    const res = await a.post("/api/conversations/group").send({ name: "Weekend trip", memberIds: [b.user._id, c.user._id] });
    assert.equal(res.status, 201);
    const group = res.body.conversation;
    assert.equal(group.members.length, 3);
    assert.equal(group.me.role, "admin");
    assert.equal((await created).conversation.name, "Weekend trip");

    const msgs = (await b.get(`/api/conversations/${group._id}/messages`)).body.messages;
    assert.equal(msgs[0].type, "system");
    assert.equal(msgs[0].system.event, "group_created");

    const got = waitFor(bSock, "message:new", (p) => p.message.type === "user");
    await send(c, group._id, "Who's driving?");
    assert.equal((await got).message.text, "Who's driving?");
  });

  it("only admins manage members; last admin leaving promotes someone", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const c = await createUser("Cara");
    const d = await createUser("Dev");
    const group = (await a.post("/api/conversations/group").send({ name: "Team", memberIds: [b.user._id, c.user._id] })).body.conversation;

    assert.equal((await b.post(`/api/conversations/${group._id}/members`).send({ userIds: [d.user._id] })).status, 403);
    const add = await a.post(`/api/conversations/${group._id}/members`).send({ userIds: [d.user._id] });
    assert.equal(add.status, 200);
    assert.equal(add.body.conversation.members.length, 4);

    // New members don't see history from before they joined (except the join notice).
    const dMsgs = (await d.get(`/api/conversations/${group._id}/messages`)).body.messages;
    assert.ok(dMsgs.every((m) => m.system?.event !== "group_created"));
    assert.ok(dMsgs.some((m) => m.system?.event === "members_added"));

    const remove = await a.delete(`/api/conversations/${group._id}/members/${c.user._id}`);
    assert.equal(remove.status, 200);
    assert.equal((await c.get(`/api/conversations/${group._id}`)).status, 404);

    const leave = await a.delete(`/api/conversations/${group._id}/members/${a.user._id}`);
    assert.equal(leave.status, 200);
    const view = (await b.get(`/api/conversations/${group._id}`)).body.conversation;
    assert.ok(view.members.some((m) => m.role === "admin"), "someone was promoted");
  });

  it("lets admins rename the group and set disappearing messages", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const group = (await a.post("/api/conversations/group").send({ name: "Old", memberIds: [b.user._id] })).body.conversation;
    assert.equal((await b.patch(`/api/conversations/${group._id}`).send({ name: "Hijack" })).status, 403);
    const rename = await a.patch(`/api/conversations/${group._id}`).send({ name: "New name" });
    assert.equal(rename.body.conversation.name, "New name");
    const timer = await a.put(`/api/conversations/${group._id}/disappearing`).send({ seconds: 86400 });
    assert.equal(timer.body.conversation.disappearingSeconds, 86400);
    const msg = await send(b, group._id, "this will vanish");
    assert.ok(msg.expiresAt, "new messages get an expiry");
  });
});
