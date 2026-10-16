import { badRequest } from "../lib/errors.js";

/**
 * Validates req[source] with a zod schema. Parsed (trimmed/coerced) values
 * are merged into req.data; unknown keys are stripped. Rejecting non-string
 * values here also closes NoSQL-injection holes such as
 * `{ "email": { "$ne": null } }`.
 */
export const validate = (schema, source = "body") => (req, res, next) => {
  const input = source === "query" ? req.query : source === "params" ? req.params : req.body;
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.join(".") || undefined;
    return next(badRequest(issue?.message || "Invalid request", field ? { field } : undefined));
  }
  req.data = { ...(req.data || {}), ...result.data };
  next();
};
