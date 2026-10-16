import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { env, features } from "../config/env.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import PushSubscription from "../models/pushSubscription.model.js";
import Reminder from "../models/reminder.model.js";
import ScheduledMessage from "../models/scheduledMessage.model.js";
import User from "../models/user.model.js";
import { badRequest, conflict, tooMany, unauthorized, unavailable } from "../lib/errors.js";
import { passwordResetAvailable, sendOtpEmail } from "../lib/mailer.js";
import { disconnectUserSockets, emitToUser } from "../lib/realtime.js";
import { invalidateBlocks, invalidateContacts } from "../lib/cache.js";
import { selfUser } from "../lib/serializers.js";
import { deleteImageByUrl, deleteStoredFile, isTrustedAvatarUrl } from "../lib/storage.js";
import { clearSession, issueSession } from "../lib/tokens.js";
import {
  generateOtp,
  hmac,
  isValidTimezone,
  randomToken,
  safeEqual,
  sha256,
} from "../lib/utils.js";
import { broadcastProfile } from "../services/user.service.js";
import { removeMemberFromGroup } from "../services/group.service.js";

const BCRYPT_ROUNDS = 10;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_MS = 40 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

const googleClient = features.google ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

// Comparing against a dummy hash when the email doesn't exist keeps login
// response times uniform, so they can't be used to discover accounts.
const DUMMY_HASH = bcrypt.hashSync("blinkchat-timing-equalizer", BCRYPT_ROUNDS);

const otpDigest = (userId, otp) => hmac(`${userId}:${otp}`, env.JWT_SECRET);

const sessionResponse = (req, res, user, status = 200) => {
  const token = issueSession(req, res, user);
  res.status(status).json({ user: selfUser(user), ...(token ? { token } : {}) });
};

/** Revokes every existing session of `user` (other devices get kicked). */
function revokeSessions(user, { exceptSocketId } = {}) {
  emitToUser(user._id, "session:revoked", { exceptSocketId: exceptSocketId || null });
  // Give clients a moment to receive the event before cutting the sockets.
  setTimeout(() => disconnectUserSockets(user._id, { exceptSocketId }), 300);
}

export const signup = async (req, res) => {
  const { fullName, email, password, timezone } = req.data;

  if (await User.exists({ email })) throw conflict("An account with this email already exists. Try signing in instead.");

  const user = await User.create({
    fullName,
    email,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    hasPassword: true,
    timezone: isValidTimezone(timezone) ? timezone : "UTC",
  });

  sessionResponse(req, res, user, 201);
};

export const login = async (req, res) => {
  const { email, password } = req.data;
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw unauthorized("Incorrect email or password");
  }
  if (!user.hasPassword) {
    throw badRequest("This account uses Google sign-in. Continue with Google, or use “Forgot password” to set a password.");
  }
  if (!user.password || !(await bcrypt.compare(password, user.password))) {
    throw unauthorized("Incorrect email or password");
  }

  sessionResponse(req, res, user);
};

export const logout = (req, res) => {
  clearSession(res);
  res.json({ message: "Logged out" });
};

/** "Log out of all devices": bumps tokenVersion so every JWT dies. */
export const logoutAll = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } }, { new: true });
  revokeSessions(user);
  clearSession(res);
  res.json({ message: "Logged out of all devices" });
};

export const googleAuth = async (req, res) => {
  if (!googleClient) throw unavailable("Google sign-in isn't configured on this server");
  const { credential, timezone } = req.data;

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw unauthorized("Google sign-in failed. Please try again.");
  }

  // Only trust emails Google has verified; otherwise anyone could create a
  // Google account for someone else's address and take over their account.
  if (!payload?.email || payload.email_verified !== true) {
    throw unauthorized("Your Google account email isn't verified.");
  }

  const email = payload.email.toLowerCase();
  const googleId = payload.sub;
  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (!user) {
    user = await User.create({
      fullName: (payload.name || email.split("@")[0]).slice(0, 60),
      email,
      password: await bcrypt.hash(randomToken(24), BCRYPT_ROUNDS),
      hasPassword: false,
      profilePic: payload.picture || "",
      authProvider: "google",
      googleId,
      timezone: isValidTimezone(timezone) ? timezone : "UTC",
    });
  } else if (!user.googleId) {
    // Existing email/password account: link Google so both methods work.
    user.googleId = googleId;
    if (!user.profilePic && payload.picture) user.profilePic = payload.picture;
    await user.save();
  }

  sessionResponse(req, res, user);
};

export const checkAuth = (req, res) => {
  // Re-issuing on every check gives a sliding session: active users never
  // get logged out unexpectedly.
  sessionResponse(req, res, req.user);
};

export const updateProfile = async (req, res) => {
  const { fullName, about, phone, timezone, profilePic, settings, status, focus } = req.data;
  const user = req.user;
  let oldAvatar = null;

  if (fullName !== undefined) user.fullName = fullName;
  if (about !== undefined) user.about = about;
  if (phone !== undefined) user.phone = phone;
  if (timezone !== undefined && isValidTimezone(timezone)) user.timezone = timezone;

  if (profilePic !== undefined && profilePic !== user.profilePic) {
    if (profilePic && !isTrustedAvatarUrl(profilePic)) throw badRequest("Please upload the photo through BlinkChat");
    oldAvatar = user.profilePic;
    user.profilePic = profilePic;
  }

  if (settings) {
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) user.settings[key] = value;
    }
  }

  if (status !== undefined) {
    user.status = status
      ? { emoji: status.emoji || "", text: status.text || "", expiresAt: status.expiresAt || null }
      : { emoji: "", text: "", expiresAt: null };
  }

  if (focus !== undefined) {
    const until = focus.until && focus.until.getTime() > Date.now() ? focus.until : null;
    user.focus = { until, allowUrgent: focus.allowUrgent ?? user.focus?.allowUrgent ?? true };
  }

  await user.save();

  if (oldAvatar) deleteImageByUrl(oldAvatar);

  res.json({ user: selfUser(user) });
  broadcastProfile(user).catch(() => {});
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.data;
  const user = await User.findById(req.user._id).select("+password");

  if (user.hasPassword) {
    if (!currentPassword) throw badRequest("Enter your current password");
    if (!(await bcrypt.compare(currentPassword, user.password || ""))) throw badRequest("Your current password is incorrect");
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.hasPassword = true;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Keep this device signed in, sign everything else out.
  revokeSessions(user, { exceptSocketId: req.headers["x-socket-id"] });
  sessionResponse(req, res, user);
};

export const deleteAccount = async (req, res) => {
  const { password, deleteMessages } = req.data;
  const user = await User.findById(req.user._id).select("+password");

  if (user.hasPassword && !(await bcrypt.compare(password || "", user.password || ""))) {
    throw badRequest("Incorrect password");
  }

  // Leave every group (keeps admin succession + system notices correct).
  const groups = await Conversation.find({ type: "group", "members.user": user._id });
  for (const group of groups) {
    await removeMemberFromGroup(group, user._id, { event: "member_left" });
  }

  const directs = await Conversation.find({ type: "direct", "members.user": user._id }).select("members.user").lean();
  const contactIds = directs.flatMap((c) => c.members.map((m) => m.user));

  if (deleteMessages) {
    const sent = await Message.find({ sender: user._id, "attachments.0": { $exists: true } }).select("attachments").lean();
    sent.forEach((m) => m.attachments.forEach((a) => deleteStoredFile(a)));
    await Message.deleteMany({ sender: user._id });
  }

  await Promise.all([
    PushSubscription.deleteMany({ user: user._id }),
    Reminder.deleteMany({ user: user._id }),
    ScheduledMessage.deleteMany({ sender: user._id }),
    User.updateMany({ blockedUsers: user._id }, { $pull: { blockedUsers: user._id } }),
  ]);
  await User.deleteOne({ _id: user._id });

  invalidateBlocks(user._id);
  invalidateContacts([user._id, ...contactIds]);
  for (const id of contactIds) emitToUser(id, "user:deleted", { userId: String(user._id) });
  revokeSessions(user);
  clearSession(res);
  res.json({ message: "Your account has been deleted" });
};

// ---- Forgot password: email -> 6-digit code -> reset token -> new password

export const forgotPassword = async (req, res) => {
  if (!passwordResetAvailable()) throw unavailable("Password reset by email isn't set up on this server yet.");

  const generic = { message: "If an account exists for that email, we've sent a 6-digit code." };
  const user = await User.findOne({ email: req.data.email }).select("+resetOtpRequestedAt");
  if (!user) return res.json(generic);

  // Per-account throttle on top of the per-IP rate limit.
  if (user.resetOtpRequestedAt && Date.now() - user.resetOtpRequestedAt.getTime() < OTP_RESEND_MS) {
    return res.json(generic);
  }

  const otp = generateOtp();
  user.resetOtpHash = otpDigest(user._id, otp);
  user.resetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.resetOtpAttempts = 0;
  user.resetOtpRequestedAt = new Date();
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  await user.save();

  try {
    await sendOtpEmail(user.email, otp, user.fullName);
  } catch (err) {
    console.error("[mail] could not send reset code:", err.message);
    throw unavailable("We couldn't send the email right now. Please try again in a moment.");
  }
  res.json(generic);
};

export const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.data;
  const now = new Date();

  // Atomically consume one attempt *before* comparing, so parallel guesses
  // can never exceed OTP_MAX_ATTEMPTS.
  const user = await User.findOneAndUpdate(
    { email, resetOtpHash: { $type: "string" }, resetOtpExpiresAt: { $gt: now }, resetOtpAttempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { resetOtpAttempts: 1 } },
    { new: true }
  ).select("+resetOtpHash +resetOtpAttempts");

  if (!user) {
    const exists = await User.findOne({ email }).select("+resetOtpAttempts +resetOtpExpiresAt").lean();
    if (exists?.resetOtpExpiresAt > now && exists.resetOtpAttempts >= OTP_MAX_ATTEMPTS) {
      throw tooMany("Too many incorrect attempts. Please request a new code.");
    }
    throw badRequest("This code is invalid or has expired. Please request a new one.");
  }

  if (!safeEqual(otpDigest(user._id, otp), user.resetOtpHash)) {
    const left = OTP_MAX_ATTEMPTS - user.resetOtpAttempts;
    if (left <= 0) throw tooMany("Too many incorrect attempts. Please request a new code.");
    throw badRequest(`Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`);
  }

  const resetToken = randomToken(32);
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        resetTokenHash: sha256(resetToken),
        resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        resetOtpHash: null,
        resetOtpExpiresAt: null,
        resetOtpAttempts: 0,
      },
    }
  );
  res.json({ message: "Code verified", resetToken });
};

export const resetPassword = async (req, res) => {
  const { email, resetToken, newPassword } = req.data;
  const user = await User.findOne({ email }).select("+resetTokenHash +resetTokenExpiresAt");

  const valid =
    user?.resetTokenHash &&
    user.resetTokenExpiresAt?.getTime() > Date.now() &&
    safeEqual(sha256(resetToken), user.resetTokenHash);
  if (!valid) throw badRequest("Your reset session has expired. Please start again.");

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.hasPassword = true;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  await user.save();

  revokeSessions(user);
  res.json({ message: "Password updated. You can sign in with your new password." });
};
