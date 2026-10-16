export class HttpError extends Error {
  constructor(status, message, extra = undefined) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const badRequest = (message = "Bad request", extra) => new HttpError(400, message, extra);
export const unauthorized = (message = "Please sign in to continue") => new HttpError(401, message);
export const forbidden = (message = "You don't have permission to do that") => new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message = "Conflict") => new HttpError(409, message);
export const gone = (message = "No longer available") => new HttpError(410, message);
export const tooMany = (message = "Too many requests. Please slow down.") => new HttpError(429, message);
export const unavailable = (message = "Service unavailable") => new HttpError(503, message);
