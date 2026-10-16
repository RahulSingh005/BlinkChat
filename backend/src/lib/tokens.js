import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const AUTH_COOKIE = "jwt";

const cookieOptions = () => ({
  httpOnly: true, // not readable from JavaScript
  sameSite: env.COOKIE_SAMESITE,
  secure: env.COOKIE_SECURE,
  path: "/",
});

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), v: user.tokenVersion || 0 }, env.JWT_SECRET, {
    expiresIn: `${env.JWT_EXPIRES_DAYS}d`,
  });

/** Returns the decoded payload or null (never throws). */
export const verifyToken = (token) => {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    // Accept tokens issued by the previous version ({ userId }) as well.
    const userId = decoded.sub || decoded.userId;
    if (!userId) return null;
    return { userId, version: decoded.v || 0 };
  } catch {
    return null;
  }
};

export const readBearer = (header = "") => {
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : null;
};

export const getRequestToken = (req) => readBearer(req.headers.authorization) || req.cookies?.[AUTH_COOKIE] || null;

/**
 * Issues a session for `user`: always sets the httpOnly cookie, and also
 * returns the raw token when the client asked for token mode (frontend on a
 * different domain where browsers like iOS Safari block third-party cookies).
 */
export const issueSession = (req, res, user) => {
  const token = signToken(user);
  res.cookie(AUTH_COOKIE, token, {
    ...cookieOptions(),
    maxAge: env.JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  });
  return wantsTokenMode(req) ? token : undefined;
};

export const clearSession = (res) => {
  // Attributes must match the ones used when setting the cookie or some
  // browsers keep the original cookie around.
  res.clearCookie(AUTH_COOKIE, cookieOptions());
};

export const wantsTokenMode = (req) => String(req.headers["x-auth-mode"] || "").toLowerCase() === "token";
