import { client, connectSocket, createUser, resetDb, setup, teardown, waitFor } from "./helpers.js";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import User from "../src/models/user.model.js";
import { hmac } from "../src/lib/utils.js";

describe("auth", () => {
  before(setup);
  after(teardown);
  beforeEach(resetDb);

  it("signs up with a normalized email and returns the full profile", async () => {
    const c = client();
    const res = await c.post("/api/auth/signup").send({ fullName: "  Ana Lima ", email: "  Ana@Example.COM ", password: "secret123", timezone: "Asia/Kolkata" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, "ana@example.com");
    assert.equal(res.body.user.fullName, "Ana Lima");
    assert.equal(res.body.user.timezone, "Asia/Kolkata");
    assert.equal(res.body.user.hasPassword, true);
    assert.equal(res.body.token, undefined, "token only returned in token mode");
    assert.ok(res.headers["set-cookie"].some((c2) => c2.startsWith("jwt=") && /HttpOnly/i.test(c2)));

    const dup = await client().post("/api/auth/signup").send({ fullName: "X", email: "ana@example.com", password: "secret123" });
    assert.equal(dup.status, 409);
  });

  it("rejects NoSQL-injection payloads and bad input with 400", async () => {
    const res = await client().post("/api/auth/login").send({ email: { $ne: null }, password: "x" });
    assert.equal(res.status, 400);
    const short = await client().post("/api/auth/signup").send({ fullName: "A", email: "a@b.co", password: "123" });
    assert.equal(short.status, 400);
    assert.match(short.body.message, /at least 6/);
  });

  it("requires the CSRF header on state-changing requests", async () => {
    const { agent } = client();
    const res = await agent.post("/api/auth/login").send({ email: "a@b.co", password: "secret123" });
    assert.equal(res.status, 403);
  });

  it("logs in case-insensitively, rejects bad passwords, and checks the session", async () => {
    const u = await createUser("Bob");
    const bad = await client().post("/api/auth/login").send({ email: u.email, password: "wrong-pass" });
    assert.equal(bad.status, 401);

    const c = client();
    const ok = await c.post("/api/auth/login").send({ email: u.email.toUpperCase(), password: u.password });
    assert.equal(ok.status, 200);
    const check = await c.get("/api/auth/check");
    assert.equal(check.status, 200);
    assert.equal(check.body.user._id, u.user._id);
  });

  it("returns 401 (not 500) for invalid tokens and supports bearer token mode", async () => {
    const res = await client().get("/api/auth/check").set("Cookie", "jwt=garbage");
    assert.equal(res.status, 401);

    const u = await createUser("Tok");
    const login = await client().post("/api/auth/login").set("X-Auth-Mode", "token").send({ email: u.email, password: u.password });
    assert.ok(login.body.token);
    const viaBearer = await client().get("/api/auth/check").set("Authorization", `Bearer ${login.body.token}`);
    assert.equal(viaBearer.status, 200);
  });

  it("changing the password revokes other sessions", async () => {
    const u = await createUser("Carol");
    const other = client();
    await other.post("/api/auth/login").send({ email: u.email, password: u.password });
    assert.equal((await other.get("/api/auth/check")).status, 200);

    const change = await u.put("/api/auth/password").send({ currentPassword: u.password, newPassword: "newsecret123" });
    assert.equal(change.status, 200);
    assert.equal((await other.get("/api/auth/check")).status, 401, "old session revoked");
    assert.equal((await u.get("/api/auth/check")).status, 200, "current session re-issued");
  });

  it("log out everywhere revokes all sessions and notifies sockets", async () => {
    const u = await createUser("Dan");
    const socket = await connectSocket(u.cookie);
    const revoked = waitFor(socket, "session:revoked");
    const res = await u.post("/api/auth/logout-all");
    assert.equal(res.status, 200);
    await revoked;
    assert.equal((await client().get("/api/auth/check").set("Cookie", u.cookie)).status, 401);
  });

  it("password reset: OTP attempts are limited and a reset token is required", async () => {
    const u = await createUser("Erin");
    const forgot = await client().post("/api/auth/forgot-password").send({ email: u.email });
    assert.equal(forgot.status, 200);
    const unknown = await client().post("/api/auth/forgot-password").send({ email: "nobody@example.com" });
    assert.equal(unknown.status, 200, "same response for unknown emails");

    // Plant a known code (the real one is only emailed/logged).
    await User.updateOne({ _id: u.user._id }, { $set: { resetOtpHash: hmac(`${u.user._id}:123456`, process.env.JWT_SECRET) } });

    // Skipping verification no longer works.
    const skip = await client().post("/api/auth/reset-password").send({ email: u.email, resetToken: "a".repeat(64), newPassword: "hacked123" });
    assert.equal(skip.status, 400);

    const wrong = await client().post("/api/auth/verify-reset-otp").send({ email: u.email, otp: "000000" });
    assert.equal(wrong.status, 400);
    assert.match(wrong.body.message, /4 attempts left/);

    const verify = await client().post("/api/auth/verify-reset-otp").send({ email: u.email, otp: "123456" });
    assert.equal(verify.status, 200);
    assert.match(verify.body.resetToken, /^[a-f0-9]{64}$/);

    const reset = await client().post("/api/auth/reset-password").send({ email: u.email, resetToken: verify.body.resetToken, newPassword: "brandnew123" });
    assert.equal(reset.status, 200);
    assert.equal((await client().get("/api/auth/check").set("Cookie", u.cookie)).status, 401, "old sessions revoked");
    const login = await client().post("/api/auth/login").send({ email: u.email, password: "brandnew123" });
    assert.equal(login.status, 200);

    // Token is single-use.
    const reuse = await client().post("/api/auth/reset-password").send({ email: u.email, resetToken: verify.body.resetToken, newPassword: "again12345" });
    assert.equal(reuse.status, 400);
  });

  it("locks the OTP after 5 wrong guesses, even when sent in parallel", async () => {
    const u = await createUser("Finn");
    await client().post("/api/auth/forgot-password").send({ email: u.email });
    await User.updateOne({ _id: u.user._id }, { $set: { resetOtpHash: hmac(`${u.user._id}:654321`, process.env.JWT_SECRET) } });
    const guesses = await Promise.all(
      Array.from({ length: 12 }, (_, i) => client().post("/api/auth/verify-reset-otp").send({ email: u.email, otp: String(100000 + i) }))
    );
    assert.ok(guesses.every((g) => g.status === 400 || g.status === 429));
    const right = await client().post("/api/auth/verify-reset-otp").send({ email: u.email, otp: "654321" });
    assert.equal(right.status, 429, "correct code rejected after lockout");
  });

  it("updates profile, settings, status and focus mode; validates avatar URLs", async () => {
    const u = await createUser("Gus");
    const res = await u.put("/api/auth/profile").send({
      about: "Shipping things",
      phone: "+91 98765 43210",
      timezone: "Europe/Paris",
      settings: { readReceipts: false, language: "fr" },
      status: { emoji: "🎯", text: "Focusing", expiresAt: new Date(Date.now() + 3600e3).toISOString() },
      focus: { until: new Date(Date.now() + 3600e3).toISOString(), allowUrgent: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.settings.readReceipts, false);
    assert.equal(res.body.user.settings.language, "fr");
    assert.equal(res.body.user.status.text, "Focusing");
    assert.ok(res.body.user.focus.until);

    const evil = await u.put("/api/auth/profile").send({ profilePic: "https://evil.example.com/track.png" });
    assert.equal(evil.status, 400);
  });

  it("deletes the account", async () => {
    const u = await createUser("Hal");
    const wrong = await u.delete("/api/auth/account").send({ password: "nope", confirm: "DELETE" });
    assert.equal(wrong.status, 400);
    const res = await u.delete("/api/auth/account").send({ password: u.password, confirm: "DELETE" });
    assert.equal(res.status, 200);
    assert.equal(await User.countDocuments({ _id: u.user._id }), 0);
  });
});
