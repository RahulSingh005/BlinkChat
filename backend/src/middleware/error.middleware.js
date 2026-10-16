import multer from "multer";
import { env } from "../config/env.js";
import { HttpError } from "../lib/errors.js";

export const notFoundApi = (req, res) => {
  res.status(404).json({ message: `No API route for ${req.method} ${req.originalUrl}` });
};

// Express 5 forwards rejected promises from async handlers here.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.extra || {}) });
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message = err.code === "LIMIT_FILE_SIZE" ? "That file is too large." : "Upload failed. Please try another file.";
    return res.status(status).json({ message });
  }
  if (err?.type === "entity.too.large") return res.status(413).json({ message: "Request is too large." });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ message: "Malformed JSON body." });
  if (err?.name === "CastError") return res.status(400).json({ message: "Invalid id." });
  if (err?.name === "ValidationError") {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({ message: first?.message || "Invalid data." });
  }
  if (err?.code === 11000) return res.status(409).json({ message: "That already exists." });
  if (err?.message === "Not allowed by CORS") return res.status(403).json({ message: "Origin not allowed." });

  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({
    message: "Something went wrong on our side. Please try again.",
    ...(env.isProd ? {} : { detail: err?.message }),
  });
};
