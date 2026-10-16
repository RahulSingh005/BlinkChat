import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    // Never returned unless explicitly selected with "+password".
    password: {
      type: String,
      select: false,
    },
    // Google-only accounts get a random password hash; this tells the UI
    // whether "change password" needs the current one.
    hasPassword: {
      type: Boolean,
      default: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: {
      type: String,
      default: null,
    },
    profilePic: {
      type: String,
      default: "",
    },
    about: {
      type: String,
      default: "Hey there! I am using BlinkChat.",
      maxlength: 150,
    },
    phone: {
      type: String,
      default: "",
      maxlength: 24,
    },
    // IANA zone, e.g. "Asia/Kolkata". Powers "their local time" and
    // "send at their morning".
    timezone: {
      type: String,
      default: "UTC",
      maxlength: 64,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    blockedUsers: {
      type: [{ type: ObjectId, ref: "User" }],
      default: [],
    },
    // Bumped to invalidate every issued JWT (password change, "log out
    // everywhere", password reset).
    tokenVersion: {
      type: Number,
      default: 0,
    },
    settings: {
      showLastSeen: { type: Boolean, default: true },
      readReceipts: { type: Boolean, default: true },
      shareLocalTime: { type: Boolean, default: true },
      notificationPreviews: { type: Boolean, default: true },
      language: { type: String, default: "en", maxlength: 12 },
    },
    // Slack-style custom status with optional expiry.
    status: {
      emoji: { type: String, default: "", maxlength: 16 },
      text: { type: String, default: "", maxlength: 80 },
      expiresAt: { type: Date, default: null },
    },
    // Focus mode: notifications are held until `until`. Contacts see it and
    // can still flag a message as urgent if `allowUrgent` is on.
    focus: {
      until: { type: Date, default: null },
      allowUrgent: { type: Boolean, default: true },
    },
    aiUsage: {
      day: { type: String, default: "" },
      count: { type: Number, default: 0 },
    },

    // Password reset (OTP -> short-lived reset token). Hidden by default.
    resetOtpHash: { type: String, default: null, select: false },
    resetOtpExpiresAt: { type: Date, default: null, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    resetOtpRequestedAt: { type: Date, default: null, select: false },
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

// Unique only for real Google ids; legacy documents store `null`.
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: "string" } } }
);
userSchema.index({ fullName: 1 });

const User = mongoose.model("User", userSchema);

export default User;
