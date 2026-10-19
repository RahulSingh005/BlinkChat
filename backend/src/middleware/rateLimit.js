import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

const MINUTE = 60 * 1000;

const make = ({ windowMs, limit, message, perUser = false, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    skip: () => env.isTest,
    message: { message },
    keyGenerator: (req) => (perUser && req.user ? `u:${req.user._id}` : ipKeyGenerator(req.ip || "unknown")),
  });

// Whole API, per IP. Generous: it's a safety net, not a product limit.
export const apiLimiter = make({ windowMs: MINUTE, limit: 600, message: "Too many requests. Please slow down." });

// Login / signup / Google: only failed attempts count.
export const authLimiter = make({
  windowMs: 15 * MINUTE,
  limit: 20,
  skipSuccessfulRequests: true,
  message: "Too many sign-in attempts. Please wait a few minutes and try again.",
});

export const otpRequestLimiter = make({
  windowMs: 15 * MINUTE,
  limit: 5,
  message: "Too many code requests. Please wait a few minutes.",
});

export const otpVerifyLimiter = make({
  windowMs: 15 * MINUTE,
  limit: 20,
  message: "Too many attempts. Please wait a few minutes.",
});

export const messageLimiter = make({
  windowMs: MINUTE,
  limit: 120,
  perUser: true,
  message: "You're sending messages too quickly.",
});

export const uploadLimiter = make({
  windowMs: 10 * MINUTE,
  limit: 60,
  perUser: true,
  message: "Too many uploads. Please wait a bit.",
});

export const gifLimiter = make({
  windowMs: MINUTE,
  limit: 90,
  perUser: true,
  message: "Slow down a little, too many GIF searches.",
});

export const inviteLimiter = make({
  windowMs: 10 * MINUTE,
  limit: 40,
  perUser: true,
  message: "Too many invite link attempts. Please wait a few minutes.",
});

export const storyLimiter = make({
  windowMs: 60 * MINUTE,
  limit: 40,
  perUser: true,
  message: "You're posting status updates too quickly.",
});

export const aiLimiter = make({
  windowMs: 5 * MINUTE,
  limit: 40,
  perUser: true,
  message: "AI is cooling down. Try again in a few minutes.",
});
