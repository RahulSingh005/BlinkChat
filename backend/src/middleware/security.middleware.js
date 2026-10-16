import { forbidden } from "../lib/errors.js";

/**
 * CSRF defence: state-changing API calls must carry a custom header (our
 * axios client always sends one). Browsers can't add custom headers to
 * cross-site form posts, and a cross-origin fetch with one triggers a CORS
 * preflight that the origin allowlist rejects.
 */
export const requireAjaxHeader = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers["x-requested-with"] || req.headers.authorization) return next();
  next(forbidden("Request blocked: missing X-Requested-With header"));
};
