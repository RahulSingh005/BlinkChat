const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/;
const VIDEO_TYPES = /^video\/(mp4|webm|quicktime|3gpp)$/;
const AUDIO_TYPES = /^audio\//;

export function kindOf(file) {
  const type = (file?.type || "").toLowerCase();
  if (IMAGE_TYPES.test(type)) return "image";
  if (VIDEO_TYPES.test(type)) return "video";
  if (AUDIO_TYPES.test(type)) return "audio";
  return "file";
}

const loadBitmap = async (file) => {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

/**
 * Downscales big photos before upload (phone cameras produce 4-12 MB
 * images; this typically ships 200-600 KB). GIFs are left untouched so
 * they keep animating; small images are sent as-is.
 */
export async function prepareImage(file, { maxSide = 2048, quality = 0.84 } = {}) {
  if (file.type === "image/gif" || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
    const dims = await imageSize(file).catch(() => ({}));
    return { file, ...dims };
  }
  let bitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    return { file, width: null, height: null };
  }
  const w0 = bitmap.width;
  const h0 = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);
  if (scale === 1 && file.size < 1.2 * 1024 * 1024) {
    bitmap.close?.();
    return { file, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const keepAlpha = file.type === "image/png";
  if (!keepAlpha) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const type = keepAlpha ? "image/png" : "image/jpeg";
  const blob = await canvasToBlob(canvas, type, quality);
  if (!blob || blob.size >= file.size) return { file, width, height };
  const name = file.name.replace(/\.[^.]+$/, "") + (keepAlpha ? ".png" : ".jpg");
  return { file: new File([blob], name, { type, lastModified: Date.now() }), width, height };
}

export async function imageSize(file) {
  const bitmap = await loadBitmap(file);
  const out = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return out;
}

export function videoMeta(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const done = (meta) => {
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    video.onloadedmetadata = () =>
      done({
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        duration: Number.isFinite(video.duration) ? video.duration : null,
      });
    video.onerror = () => done({ width: null, height: null, duration: null });
    video.src = url;
  });
}

/** Square, centered crop for profile and group photos. */
export async function cropSquare(file, size = 512) {
  const bitmap = await loadBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

export const extOf = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

/** Fits media into a bubble while keeping its aspect ratio (no layout shift). */
export function fitBox(width, height, { maxW = 300, maxH = 340, minW = 140 } = {}) {
  if (!width || !height) return { width: maxW, height: Math.round(maxW * 0.75) };
  const ratio = width / height;
  let w = Math.min(maxW, width);
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  if (w < minW) {
    w = minW;
    h = Math.min(maxH, w / ratio);
  }
  return { width: Math.round(w), height: Math.round(h) };
}

export const canRecordVoice = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
