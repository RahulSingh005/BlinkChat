import { client, connectSocket, createUser, resetDb, setup, sleep, teardown, waitFor } from "./helpers.js";
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import Conversation from "../src/models/conversation.model.js";
import Message from "../src/models/message.model.js";
import Story from "../src/models/story.model.js";
import { signMediaAttachment } from "../src/lib/klipy.js";
import { sweepExpiredStories } from "../src/controllers/story.controller.js";

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

const makeGroup = async (admin, members, name = "Weekend") => {
  const res = await admin.post("/api/conversations/group").send({ name, memberIds: members.map((m) => m.user._id) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.conversation;
};

const convFor = async (u, id) => (await u.get(`/api/conversations/${id}`)).body.conversation;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

const upload = async (u) => {
  const res = await u.post("/api/uploads").field("purpose", "message").attach("file", PNG, { filename: "p.png", contentType: "image/png" });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.attachment;
};

describe("rich messages", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  it("answers the boot session check with 200 for guests and users", async () => {
    const guest = await client().get("/api/auth/session");
    assert.equal(guest.status, 200);
    assert.equal(guest.body.user, null);
    const a = await createUser("Alice");
    const me = await a.get("/api/auth/session");
    assert.equal(me.status, 200);
    assert.equal(me.body.user._id, a.user._id);
  });

  it("gives everyone a private Saved Messages chat", async () => {
    const a = await createUser("Alice");
    const s1 = (await a.get("/api/conversations/self")).body.conversation;
    const s2 = (await a.get("/api/conversations/self")).body.conversation;
    assert.equal(s1._id, s2._id);
    assert.equal(s1.type, "self");
    assert.equal(s1.members.length, 1);
    const msg = await send(a, s1._id, "note to self https://example.invalid");
    assert.equal(msg.text, "note to self https://example.invalid");
    const list = (await a.get("/api/conversations")).body.conversations;
    const saved = list.find((c) => c._id === s1._id);
    assert.ok(saved);
    assert.equal(saved.me.unreadCount, 0);
    const viewOnce = await a.post(`/api/conversations/${s1._id}/messages`).send({ attachments: [await upload(a)], viewOnce: true });
    assert.equal(viewOnce.status, 400);
  });

  it("runs polls: single choice, changing votes, ending", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const c = await createUser("Cara");
    const group = await makeGroup(a, [b, c]);

    const bad = await a.post(`/api/conversations/${group._id}/messages`).send({ poll: { question: "Where?", options: ["Park"] } });
    assert.equal(bad.status, 400);
    const dupes = await a.post(`/api/conversations/${group._id}/messages`).send({ poll: { question: "Where?", options: ["Park", "park"] } });
    assert.equal(dupes.status, 400);

    const poll = await send(a, group._id, { poll: { question: "Where to?", options: ["Park", "Beach", "Cinema"] } });
    assert.equal(poll.poll.question, "Where to?");
    assert.deepEqual(poll.poll.options.map((o) => o.id), ["1", "2", "3"]);

    let res = await b.post(`/api/messages/${poll._id}/poll/vote`).send({ optionIds: ["1", "2"] });
    assert.equal(res.status, 200);
    // Single choice keeps only the first option.
    assert.deepEqual(res.body.message.poll.options.map((o) => o.voters.length), [1, 0, 0]);
    res = await b.post(`/api/messages/${poll._id}/poll/vote`).send({ optionIds: ["3"] });
    assert.deepEqual(res.body.message.poll.options.map((o) => o.voters.length), [0, 0, 1]);
    res = await c.post(`/api/messages/${poll._id}/poll/vote`).send({ optionIds: ["3"] });
    assert.deepEqual(res.body.message.poll.options[2].voters.sort(), [b.user._id, c.user._id].sort());

    assert.equal((await b.post(`/api/messages/${poll._id}/poll/close`)).status, 403);
    const closed = await a.post(`/api/messages/${poll._id}/poll/close`);
    assert.ok(closed.body.message.poll.closedAt);
    assert.equal((await c.post(`/api/messages/${poll._id}/poll/vote`).send({ optionIds: ["1"] })).status, 400);

    const multi = await send(a, group._id, { poll: { question: "Snacks?", options: ["Chips", "Fruit"], multiple: true } });
    res = await b.post(`/api/messages/${multi._id}/poll/vote`).send({ optionIds: ["1", "2", "nope"] });
    assert.deepEqual(res.body.message.poll.options.map((o) => o.voters.length), [1, 1]);
    res = await b.post(`/api/messages/${multi._id}/poll/vote`).send({ optionIds: [] });
    assert.deepEqual(res.body.message.poll.options.map((o) => o.voters.length), [0, 0]);
  });

  it("tracks @mentions per member and notifies through mute", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const c = await createUser("Cara");
    const outsider = await createUser("Olly");
    const group = await makeGroup(a, [b, c]);

    const msg = await send(a, group._id, { text: "@Bob look", mentions: [b.user._id, outsider.user._id, a.user._id] });
    assert.deepEqual(msg.mentions, [b.user._id]);
    assert.equal((await convFor(b, group._id)).me.mentionCount, 1);
    assert.equal((await convFor(c, group._id)).me.mentionCount, 0);
    assert.equal((await convFor(c, group._id)).me.unreadCount, 1);

    await b.post(`/api/conversations/${group._id}/read`);
    const after = await convFor(b, group._id);
    assert.equal(after.me.mentionCount, 0);
    assert.equal(after.me.unreadCount, 0);

    const direct = await openDirect(a, b);
    const dm = await send(a, direct._id, { text: "hi", mentions: [b.user._id] });
    assert.deepEqual(dm.mentions, []);
  });

  it("pins up to three messages (admins in groups) and drops deleted ones", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const group = await makeGroup(a, [b]);
    const msgs = [];
    for (const t of ["one", "two", "three", "four"]) msgs.push(await send(b, group._id, t));

    assert.equal((await b.post(`/api/conversations/${group._id}/pins`).send({ messageId: msgs[0]._id })).status, 403);
    for (const m of msgs) {
      const res = await a.post(`/api/conversations/${group._id}/pins`).send({ messageId: m._id });
      assert.equal(res.status, 200, JSON.stringify(res.body));
    }
    let conv = await convFor(b, group._id);
    assert.deepEqual(conv.pinned.map((p) => p.message.text), ["four", "three", "two"]);
    const pinNotices = await Message.countDocuments({ conversation: group._id, "system.event": "message_pinned" });
    assert.equal(pinNotices, 4);

    await b.delete(`/api/messages/${msgs[3]._id}?scope=everyone`);
    conv = await convFor(b, group._id);
    assert.deepEqual(conv.pinned.map((p) => p.message.text), ["three", "two"]);

    await a.delete(`/api/conversations/${group._id}/pins/${msgs[2]._id}`);
    conv = await convFor(a, group._id);
    assert.deepEqual(conv.pinned.map((p) => p.message.text), ["two"]);

    // Either person can pin in a 1:1 chat.
    const direct = await openDirect(a, b);
    const dm = await send(a, direct._id, "pin me");
    const pinned = await b.post(`/api/conversations/${direct._id}/pins`).send({ messageId: dm._id });
    assert.equal(pinned.body.conversation.pinned[0].message._id, dm._id);
  });

  it("stars messages privately per person", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    const m1 = await send(a, conv._id, "remember this");
    await send(a, conv._id, "not this");

    const sockA = await connectSocket(a.cookie);
    const synced = waitFor(sockA, "message:starred");
    assert.equal((await a.put(`/api/messages/${m1._id}/star`).send({ starred: true })).status, 200);
    assert.equal((await synced).starred, true);

    const mine = (await a.get("/api/messages/starred")).body.messages;
    assert.deepEqual(mine.map((m) => m.text), ["remember this"]);
    assert.equal(mine[0].starred, true);
    assert.equal((await b.get("/api/messages/starred")).body.messages.length, 0);

    const page = (await b.get(`/api/conversations/${conv._id}/messages`)).body.messages;
    assert.equal(page.find((m) => m._id === m1._id).starred, false);

    await a.put(`/api/messages/${m1._id}/star`).send({ starred: false });
    assert.equal((await a.get("/api/messages/starred")).body.messages.length, 0);
  });

  it("serves view-once media exactly once to each recipient", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    const att = await upload(a);
    const two = await a.post(`/api/conversations/${conv._id}/messages`).send({ attachments: [att, att], viewOnce: true });
    assert.equal(two.status, 400);

    const msg = await send(a, conv._id, { attachments: [att], viewOnce: true });
    assert.equal(msg.viewOnce, true);
    assert.equal(msg.attachments[0].url, null);

    const listed = (await b.get(`/api/conversations/${conv._id}/messages`)).body.messages.find((m) => m._id === msg._id);
    assert.equal(listed.attachments[0].url, null);
    assert.equal(listed.viewOnceOpened, false);

    assert.equal((await a.post(`/api/messages/${msg._id}/view-once`)).status, 403);
    const open = await b.post(`/api/messages/${msg._id}/view-once`);
    assert.equal(open.status, 200);
    assert.equal(open.body.attachments[0].url, att.url);
    assert.equal((await b.post(`/api/messages/${msg._id}/view-once`)).status, 410);

    const seen = (await a.get(`/api/conversations/${conv._id}/messages`)).body.messages.find((m) => m._id === msg._id);
    assert.deepEqual(seen.viewedBy, [b.user._id]);
    assert.equal((await b.post(`/api/messages/${msg._id}/forward`).send({ conversationIds: [conv._id] })).status, 400);
  });

  it("shares locations and contact cards", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const c = await createUser("Cara");
    const conv = await openDirect(a, b);

    const loc = await send(a, conv._id, { location: { lat: 48.8584, lng: 2.2945, accuracy: 12, label: "Eiffel Tower" } });
    assert.deepEqual(loc.location, { lat: 48.8584, lng: 2.2945, accuracy: 12, label: "Eiffel Tower" });
    assert.equal((await a.post(`/api/conversations/${conv._id}/messages`).send({ location: { lat: 91, lng: 0 } })).status, 400);

    const card = await send(a, conv._id, { contactUserId: c.user._id });
    assert.equal(card.contactCard.user, c.user._id);
    assert.equal(card.contactCard.name, "Cara");

    await c.put(`/api/users/${a.user._id}/block`);
    assert.equal((await a.post(`/api/conversations/${conv._id}/messages`).send({ contactUserId: c.user._id })).status, 400);
    const both = await a.post(`/api/conversations/${conv._id}/messages`).send({ contactUserId: b.user._id, location: { lat: 1, lng: 1 } });
    assert.equal(both.status, 400);
  });

  it("only accepts GIFs signed by our proxy", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    const gif = { kind: "gif", url: "https://static.klipy.com/x/abc.gif", mp4: "https://static.klipy.com/x/abc.mp4", width: 320, height: 240, provider: "klipy" };

    assert.equal((await a.post(`/api/conversations/${conv._id}/messages`).send({ attachments: [gif] })).status, 400);
    const forged = { ...gif, sig: signMediaAttachment(gif), url: "https://evil.example.com/a.gif" };
    assert.equal((await a.post(`/api/conversations/${conv._id}/messages`).send({ attachments: [forged] })).status, 400);

    const ok = await send(a, conv._id, { attachments: [{ ...gif, sig: signMediaAttachment(gif) }] });
    assert.equal(ok.attachments[0].kind, "gif");
    assert.equal(ok.attachments[0].mp4, gif.mp4);

    // No KLIPY key configured in tests.
    assert.equal((await a.get("/api/media/gifs?q=cat")).status, 503);
    const config = (await client().get("/api/config")).body;
    assert.equal(config.features.gifs, false);
  });

  it("unfurls links into previews after sending", async () => {
    const page = http.createServer((req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<html><head><title>Fallback</title>
        <meta property="og:title" content="Trip &amp; Tips">
        <meta property="og:description" content="Ten things to pack">
        <meta property="og:site_name" content="Travel Blog"></head><body>hi</body></html>`);
    });
    await new Promise((r) => page.listen(0, "127.0.0.1", r));
    try {
      const a = await createUser("Alice");
      const b = await createUser("Bob");
      const conv = await openDirect(a, b);
      const sockB = await connectSocket(b.cookie);
      const url = `http://127.0.0.1:${page.address().port}/post`;
      const updated = waitFor(sockB, "message:updated", (p) => Boolean(p.message.linkPreview), 8000);
      const msg = await send(a, conv._id, `look ${url}`);
      const { message } = await updated;
      assert.equal(message._id, msg._id);
      assert.equal(message.linkPreview.title, "Trip & Tips");
      assert.equal(message.linkPreview.description, "Ten things to pack");
      assert.equal(message.linkPreview.siteName, "Travel Blog");
    } finally {
      page.close();
    }
  });

  it("searches across chats, exports history and keeps favorites", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const c = await createUser("Cara");
    const ab = await openDirect(a, b);
    const ac = await openDirect(a, c);
    await send(b, ab._id, "the Lisbon flight is at 9");
    await send(c, ac._id, "Lisbon hotel booked");
    await send(c, ac._id, "unrelated");

    let found = (await a.get("/api/messages/search?q=lisbon")).body.messages;
    assert.equal(found.length, 2);
    assert.equal((await a.get("/api/messages/search?q=l")).status, 400);

    await a.post(`/api/conversations/${ac._id}/clear`);
    found = (await a.get("/api/messages/search?q=lisbon")).body.messages;
    assert.deepEqual(found.map((m) => m.text), ["the Lisbon flight is at 9"]);
    assert.equal((await c.get("/api/messages/search?q=lisbon")).body.messages.length, 1);

    const exp = await a.get(`/api/conversations/${ab._id}/export`);
    assert.equal(exp.status, 200);
    assert.match(exp.headers["content-type"], /text\/plain/);
    assert.match(exp.headers["content-disposition"], /attachment/);
    assert.match(exp.text, /Bob: the Lisbon flight is at 9/);

    const fav = await a.patch(`/api/conversations/${ab._id}/settings`).send({ favorite: true });
    assert.equal(fav.body.me.favorite, true);
  });

  it("lists call history with the other person", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    await send(a, conv._id, "call me");
    await Message.create({ conversation: conv._id, sender: b.user._id, type: "call", call: { kind: "video", status: "missed" } });
    await Message.create({ conversation: conv._id, sender: a.user._id, type: "call", call: { kind: "voice", status: "completed", duration: 65 } });

    const history = (await a.get("/api/calls/history")).body;
    assert.equal(history.calls.length, 2);
    assert.equal(history.calls[0].outgoing, true);
    assert.equal(history.calls[0].message.call.duration, 65);
    assert.equal(history.calls[1].outgoing, false);
    assert.equal(history.calls[1].peer._id, b.user._id);
    assert.equal(history.calls[1].conversationId, conv._id);
  });
});

describe("groups via invite link", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  it("lets admins create, reset and revoke links; anyone with the link can join", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const newbie = await createUser("Nina");
    const group = await makeGroup(a, [b], "Book club");

    assert.equal((await b.post(`/api/conversations/${group._id}/invite`)).status, 403);
    const first = (await a.post(`/api/conversations/${group._id}/invite`)).body.inviteCode;
    assert.match(first, /^[\w-]{16}$/);
    assert.equal((await convFor(a, group._id)).inviteCode, first);
    assert.equal((await convFor(b, group._id)).inviteCode, undefined);

    const code = (await a.post(`/api/conversations/${group._id}/invite`)).body.inviteCode;
    assert.notEqual(code, first);
    assert.equal((await newbie.get(`/api/invites/${first}`)).status, 404);

    const preview = (await newbie.get(`/api/invites/${code}`)).body.group;
    assert.equal(preview.name, "Book club");
    assert.equal(preview.memberCount, 2);
    assert.equal(preview.isMember, false);

    const sockB = await connectSocket(b.cookie);
    const update = waitFor(sockB, "conversation:updated", (p) => p.conversation.members.length === 3);
    const joined = await newbie.post(`/api/invites/${code}/join`);
    assert.equal(joined.status, 201);
    assert.equal(joined.body.conversation._id, group._id);
    await update;
    const notice = await Message.findOne({ conversation: group._id, "system.event": "member_joined_link" }).lean();
    assert.ok(notice);

    const again = await newbie.post(`/api/invites/${code}/join`);
    assert.equal(again.body.alreadyMember, true);
    assert.equal((await Conversation.findById(group._id).lean()).members.length, 3);

    await a.delete(`/api/conversations/${group._id}/invite`);
    assert.equal((await newbie.get(`/api/invites/${code}`)).status, 404);
    assert.equal((await newbie.get(`/api/invites/bad`)).status, 404);
  });
});

describe("stories", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  it("shares stories with 1:1 contacts, tracks views, replies and expiry", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const stranger = await createUser("Sam");
    const conv = await openDirect(a, b);
    await send(a, conv._id, "hey");

    const sockB = await connectSocket(b.cookie);
    const announced = waitFor(sockB, "story:new");
    const created = await a.post("/api/stories").send({ kind: "text", text: "Coffee time ☕", background: "#12A594", font: "serif" });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const story = created.body.story;
    assert.equal((await announced).userId, a.user._id);
    assert.equal((await a.post("/api/stories").send({ kind: "text", text: "" })).status, 400);
    assert.equal((await a.post("/api/stories").send({ kind: "text", text: "x", background: "#123456" })).status, 400);
    const remote = await a.post("/api/stories").send({ kind: "image", media: { url: "https://evil.example.com/a.jpg", kind: "image" } });
    assert.equal(remote.status, 400);

    let feed = (await b.get("/api/stories")).body;
    assert.equal(feed.mine, null);
    assert.equal(feed.others.length, 1);
    assert.equal(feed.others[0].user._id, a.user._id);
    assert.equal(feed.others[0].hasUnseen, true);
    assert.equal((await stranger.get("/api/stories")).body.others.length, 0);
    assert.equal((await stranger.post(`/api/stories/${story._id}/view`)).status, 404);

    const sockA = await connectSocket(a.cookie);
    const viewed = waitFor(sockA, "story:viewed");
    await b.post(`/api/stories/${story._id}/view`);
    assert.equal((await viewed).viewCount, 1);
    await b.post(`/api/stories/${story._id}/view`); // idempotent
    feed = (await b.get("/api/stories")).body;
    assert.equal(feed.others[0].hasUnseen, false);

    const mine = (await a.get("/api/stories")).body.mine;
    assert.equal(mine.stories[0].viewCount, 1);
    await b.post(`/api/stories/${story._id}/react`).send({ emoji: "🔥" });
    const viewers = (await a.get(`/api/stories/${story._id}/viewers`)).body;
    assert.equal(viewers.total, 1);
    assert.equal(viewers.viewers[0].user._id, b.user._id);
    assert.equal(viewers.viewers[0].reaction, "🔥");
    assert.equal((await b.get(`/api/stories/${story._id}/viewers`)).status, 404);

    const reply = await b.post(`/api/stories/${story._id}/reply`).send({ text: "Same here!" });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.conversationId, conv._id);
    assert.equal(reply.body.message.storyReply.story, story._id);
    assert.equal(reply.body.message.storyReply.text, "Coffee time ☕");

    // Viewers with read receipts off stay anonymous.
    const c = await createUser("Cara");
    const ac = await openDirect(a, c);
    await send(c, ac._id, "hello");
    await c.put("/api/auth/profile").send({ settings: { readReceipts: false } });
    await c.post(`/api/stories/${story._id}/view`);
    assert.equal((await a.get(`/api/stories/${story._id}/viewers`)).body.total, 1);

    // Blocking hides stories both ways.
    await b.put(`/api/users/${a.user._id}/block`);
    assert.equal((await b.get("/api/stories")).body.others.length, 0);

    await Story.updateOne({ _id: story._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await c.get("/api/stories")).body.others.length, 0);
    assert.equal(await sweepExpiredStories(), 1);
    assert.equal(await Story.countDocuments(), 0);
  });

  it("lets owners delete a story", async () => {
    const a = await createUser("Alice");
    const b = await createUser("Bob");
    const conv = await openDirect(a, b);
    await send(b, conv._id, "yo");
    const story = (await a.post("/api/stories").send({ kind: "text", text: "Gone soon" })).body.story;
    assert.equal((await b.delete(`/api/stories/${story._id}`)).status, 404);
    const sockB = await connectSocket(b.cookie);
    const gone = waitFor(sockB, "story:deleted");
    assert.equal((await a.delete(`/api/stories/${story._id}`)).status, 200);
    assert.equal((await gone).storyId, story._id);
    await sleep(10);
    assert.equal((await b.get("/api/stories")).body.others.length, 0);
  });
});
