import multer from "multer";
import { badRequest } from "../lib/errors.js";
import { MAX_UPLOAD_BYTES, storeUpload } from "../lib/storage.js";

// Multipart upload (the old app sent base64 inside JSON, 33% bigger and
// held entirely in memory as a string).
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10, fieldSize: 8 * 1024 },
  defParamCharset: "utf8", // keep non-ASCII file names intact
}).single("file");

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export const uploadFile = async (req, res) => {
  if (!req.file) throw badRequest("No file received");
  const purpose = ["message", "avatar", "group"].includes(req.body?.purpose) ? req.body.purpose : "message";

  const stored = await storeUpload({
    buffer: req.file.buffer,
    mime: req.file.mimetype,
    originalName: req.file.originalname,
    purpose,
    meta: { width: num(req.body?.width), height: num(req.body?.height), duration: num(req.body?.duration) },
  });

  let waveform;
  if (stored.kind === "audio" && req.body?.waveform) {
    try {
      const parsed = JSON.parse(req.body.waveform);
      if (Array.isArray(parsed)) {
        waveform = parsed
          .slice(0, 64)
          .map((v) => Math.max(0, Math.min(1, Number(v) || 0)))
          .map((v) => Math.round(v * 100) / 100);
      }
    } catch {
      // ignore malformed waveform data
    }
  }

  res.status(201).json({
    attachment: {
      ...stored,
      voice: stored.kind === "audio" && req.body?.voice === "true",
      ...(waveform ? { waveform } : {}),
    },
  });
};
