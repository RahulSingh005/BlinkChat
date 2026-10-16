import crypto from "node:crypto";
import mongoose from "mongoose";

export const isObjectId = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value) && mongoose.isValidObjectId(value);

export const idStr = (value) => (value == null ? "" : String(value._id ?? value));

export const sameId = (a, b) => idStr(a) === idStr(b);

export const toObjectId = (value) => new mongoose.Types.ObjectId(idStr(value));

export const uniqueIds = (ids) => [...new Set(ids.map(idStr).filter(Boolean))];

// Escape user input before using it inside a RegExp (prevents ReDoS and
// regex injection through the search boxes).
export const escapeRegex = (text = "") => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const truncate = (text = "", max = 120) => {
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

// Cryptographically secure 6-digit code (Math.random is predictable).
export const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

export const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

export const hmac = (value, secret) => crypto.createHmac("sha256", secret).update(String(value)).digest("hex");

export const safeEqual = (a = "", b = "") => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

export const maskEmail = (email = "") => {
  const [name, domain] = String(email).split("@");
  if (!domain) return "";
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(2, Math.min(6, name.length - visible.length)))}@${domain}`;
};

export const isValidTimezone = (tz) => {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const isFutureDate = (date) => date instanceof Date && !Number.isNaN(date.getTime()) && date.getTime() > Date.now();

export const isActiveUntil = (date) => Boolean(date) && new Date(date).getTime() > Date.now();

export const todayKey = () => new Date().toISOString().slice(0, 10);
