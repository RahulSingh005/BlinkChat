import { api } from "./api";

/** Multipart upload with progress. Returns attachment metadata. */
export async function uploadFile(file, { purpose = "message", meta = {}, onProgress, signal } = {}) {
  const form = new FormData();
  form.append("purpose", purpose);
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  form.append("file", file, file.name || "file");
  const res = await api.post("/uploads", form, {
    timeout: 5 * 60 * 1000,
    signal,
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.min(1, e.loaded / e.total));
    },
  });
  return res.data.attachment;
}
