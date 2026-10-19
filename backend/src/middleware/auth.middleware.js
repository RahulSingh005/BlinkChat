import User from "../models/user.model.js";
import { unauthorized } from "../lib/errors.js";
import { clearSession, getRequestToken, verifyToken } from "../lib/tokens.js";

/**
 * Accepts the httpOnly cookie or an `Authorization: Bearer` token. Invalid,
 * expired or revoked tokens now return 401 (previously a bad token threw
 * inside jwt.verify and surfaced as a 500).
 */
/** Like protectRoute, but signed-out requests continue with req.user = null. */
export const optionalAuth = async (req, res, next) => {
  const decoded = verifyToken(getRequestToken(req));
  req.user = null;
  if (decoded) {
    const user = await User.findById(decoded.userId);
    if (user && (user.tokenVersion || 0) === decoded.version) req.user = user;
    else clearSession(res);
  }
  next();
};

export const protectRoute = async (req, res, next) => {
  const decoded = verifyToken(getRequestToken(req));
  if (!decoded) return next(unauthorized());

  const user = await User.findById(decoded.userId);
  if (!user || (user.tokenVersion || 0) !== decoded.version) {
    clearSession(res);
    return next(unauthorized("Your session has expired. Please sign in again."));
  }

  req.user = user;
  next();
};
