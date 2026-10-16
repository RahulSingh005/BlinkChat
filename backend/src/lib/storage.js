import fs from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { BACKEND_ROOT, env, features } from "../config/env.js";
import { badRequest } from "./errors.js";
import { randomToken } from "./utils.js";

if (features.cloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(BACKEND_ROOT, "uploads");

const MB = 1024 * 1024;
// Matches Cloudinary's free plan (10MB images/raw, 100MB video).
export const SIZE_LIMITS = { image: 10 * MB, video: 50 * MB, audio: 10 * MB, file: 10 * MB };
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(SIZE_LIMITS));

const IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};
const VIDEO_TYPES = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/3gpp": ".3gp",
};
const AUDIO_TYPES = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/opus": ".opus",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/3gpp": ".3gp",
};
// Documents are matched by extension (browsers often report a generic or
// empty MIME type for them). Anything executable or renderable as HTML/SVG
// is intentionally absent.
const FILE_EXTENSIONS = new Set([
  ".pdf", ".txt", ".csv", ".md", ".rtf", ".json",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".odt", ".ods", ".odp", ".pages", ".numbers", ".key", ".epub",
  ".zip", ".rar", ".7z", ".tar", ".gz",
]);

const extOf = (name = "") => {
  const ext = path.extname(String(name)).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
};

/** Returns { kind, ext } for an allowed upload, or throws 400. */
export function classifyUpload(mime = "", originalName = "") {
  const type = String(mime).toLowerCase().split(";")[0].trim();
  if (IMAGE_TYPES[type]) return { kind: "image", ext: IMAGE_TYPES[type] };
  if (VIDEO_TYPES[type]) return { kind: "video", ext: VIDEO_TYPES[type] };
  if (AUDIO_TYPES[type]) return { kind: "audio", ext: AUDIO_TYPES[type] };
  const ext = extOf(originalName);
  if (FILE_EXTENSIONS.has(ext)) return { kind: "file", ext };
  throw badRequest("This file type isn't supported. Try a photo, video, audio file, PDF or Office document.");
}

const cleanName = (name = "") =>
  String(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .slice(0, 160) || "file";

function uploadToCloudinary(buffer, { kind, ext, purpose }) {
  const resourceType = kind === "image" ? "image" : kind === "file" ? "raw" : "video"; // audio lives under "video"
  const id = randomToken(12);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: `blinkchat/${purpose}`,
        // Raw files keep their extension so downloads open correctly.
        public_id: resourceType === "raw" ? `${id}${ext}` : id,
        overwrite: false,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

/**
 * Persists an uploaded file and returns attachment metadata. Local files are
 * stored with a random name and referenced by a relative /uploads/... URL so
 * the database never hardcodes a hostname.
 */
export async function storeUpload({ buffer, mime, originalName, purpose = "message", meta = {} }) {
  const { kind, ext } = classifyUpload(mime, originalName);
  if (buffer.length > SIZE_LIMITS[kind]) {
    throw badRequest(`That ${kind === "file" ? "file" : kind} is too large (max ${Math.round(SIZE_LIMITS[kind] / MB)}MB).`);
  }
  if (purpose !== "message" && kind !== "image") throw badRequest("Please choose an image");

  const base = {
    kind,
    name: cleanName(originalName || `${kind}${ext}`),
    mime: String(mime || "").split(";")[0] || "application/octet-stream",
    size: buffer.length,
    width: Number.isFinite(meta.width) ? meta.width : null,
    height: Number.isFinite(meta.height) ? meta.height : null,
    duration: Number.isFinite(meta.duration) ? meta.duration : null,
  };

  if (features.cloudinary) {
    const result = await uploadToCloudinary(buffer, { kind, ext, purpose });
    return {
      ...base,
      url: result.secure_url,
      width: result.width ?? base.width,
      height: result.height ?? base.height,
      duration: result.duration ?? base.duration,
      publicId: result.public_id,
      storage: "cloudinary",
    };
  }

  const now = new Date();
  const folder = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"));
  const fileName = `${randomToken(16)}${ext}`;
  await fs.mkdir(path.join(UPLOADS_DIR, folder), { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, folder, fileName), buffer);
  const rel = `${folder.split(path.sep).join("/")}/${fileName}`;
  return { ...base, url: `/uploads/${rel}`, publicId: rel, storage: "local" };
}

/** Best-effort removal of a stored file (deleted messages, replaced avatars). */
export async function deleteStoredFile(att) {
  if (!att?.publicId) return;
  try {
    if (att.storage === "cloudinary" && features.cloudinary) {
      const resourceType = att.kind === "image" ? "image" : att.kind === "file" ? "raw" : "video";
      await cloudinary.uploader.destroy(att.publicId, { resource_type: resourceType });
    } else if (att.storage === "local" && /^[\w/-]+\.[a-z0-9]+$/i.test(att.publicId)) {
      await fs.unlink(path.join(UPLOADS_DIR, att.publicId));
    }
  } catch {
    // ignore: the file may already be gone
  }
}

const LOCAL_URL = /^\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{32}\.[a-z0-9]{1,8}$/;

/** Deletes an image we stored, given only its URL (old avatars). */
export function deleteImageByUrl(url) {
  if (typeof url !== "string" || !url) return;
  if (LOCAL_URL.test(url)) {
    deleteStoredFile({ storage: "local", kind: "image", publicId: url.replace(/^\/uploads\//, "") });
    return;
  }
  const prefix = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
  if (features.cloudinary && url.startsWith(prefix)) {
    // .../image/upload/v1712345678/blinkchat/avatar/abc123.jpg -> blinkchat/avatar/abc123
    const publicId = url
      .slice(prefix.length)
      .replace(/^v\d+\//, "")
      .replace(/\.[a-z0-9]+$/i, "");
    if (publicId.startsWith("blinkchat/")) deleteStoredFile({ storage: "cloudinary", kind: "image", publicId });
  }
}

/** Only media we stored ourselves may be referenced by messages/profiles. */
export function isTrustedMediaUrl(url) {
  if (typeof url !== "string" || url.length > 600) return false;
  if (LOCAL_URL.test(url)) return true;
  if (features.cloudinary && url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)) return true;
  return false;
}

/** Profile photos may also come from Google sign-in. */
export const isTrustedAvatarUrl = (url) =>
  isTrustedMediaUrl(url) || /^https:\/\/lh\d\.googleusercontent\.com\//.test(String(url));

export async function readStoredFile(att) {
  if (att.storage === "local" && LOCAL_URL.test(att.url)) {
    return fs.readFile(path.join(UPLOADS_DIR, att.url.replace(/^\/uploads\//, "")));
  }
  const res = await fetch(att.url);
  if (!res.ok) throw new Error(`Could not download media (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
