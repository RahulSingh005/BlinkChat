import { env } from "../config/env.js";
import { unavailable, tooMany } from "./errors.js";
import { hmac, safeEqual } from "./utils.js";

/**
 * GIFs & stickers via KLIPY (free; Tenor's API shut down in June 2026).
 * The key stays on the server; every media URL we hand out is signed so a
 * message can only reference GIFs that actually came from this proxy.
 *
 *   GET https://api.klipy.com/api/v1/{KEY}/{gifs|stickers}/{trending|search}
 */
const BASE = "https://api.klipy.com/api/v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

export const gifsEnabled = () => Boolean(env.KLIPY_API_KEY);

const signPayload = (att) => `${att.kind}|${att.url}|${att.mp4 || ""}|${att.width || 0}x${att.height || 0}`;
export const signMediaAttachment = (att) => hmac(signPayload(att), `${env.JWT_SECRET}:klipy`);
const sign = signMediaAttachment;

export const verifyMediaSignature = (att) => Boolean(att?.sig) && safeEqual(sign(att), att.sig);

const pick = (sizes, order, formats) => {
  for (const size of order) {
    for (const format of formats) {
      const f = sizes?.[size]?.[format];
      if (f?.url) return f;
    }
  }
  return null;
};

function mapItem(item, kind) {
  if (!item?.file) return null; // ads and other non-media entries
  const isSticker = kind === "sticker";
  const full = pick(item.file, ["md", "hd", "sm"], isSticker ? ["webp", "png", "gif"] : ["gif", "webp"]);
  const mp4 = isSticker ? null : pick(item.file, ["md", "hd", "sm"], ["mp4"]);
  const preview = pick(item.file, ["sm", "xs", "md"], isSticker ? ["webp", "png", "gif"] : ["webp", "gif"]);
  if (!full) return null;
  const attachment = {
    kind,
    url: full.url,
    mp4: mp4?.url || "",
    width: full.width || mp4?.width || null,
    height: full.height || mp4?.height || null,
    provider: "klipy",
    name: String(item.title || "").slice(0, 120),
  };
  return {
    id: String(item.id ?? item.slug),
    title: item.title || "",
    preview: { url: preview?.url || full.url, width: preview?.width || full.width, height: preview?.height || full.height },
    attachment: { ...attachment, sig: sign(attachment) },
  };
}

/** kind: "gif" | "sticker"; q empty → trending. */
export async function searchMedia({ kind, q = "", page = 1, perPage = 24, customerId, locale = "en_US" }) {
  if (!gifsEnabled()) throw unavailable("GIFs aren't enabled on this server.");
  const segment = kind === "sticker" ? "stickers" : "gifs";
  const endpoint = q ? "search" : "trending";
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage), customer_id: customerId, locale, rating: "pg-13" });
  if (q) params.set("q", q);
  // customer_id is left out of the cache key so trending/search results are
  // shared between users (KLIPY's free tier is rate limited).
  const key = `${segment}/${endpoint}|${q.toLowerCase()}|${page}|${perPage}|${locale}`;

  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;

  let res;
  try {
    res = await fetch(`${BASE}/${encodeURIComponent(env.KLIPY_API_KEY)}/${segment}/${endpoint}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw unavailable("Couldn't reach the GIF service. Please try again.");
  }
  if (res.status === 429) throw tooMany("GIF search is busy. Try again in a minute.");
  if (!res.ok) throw unavailable("The GIF service is unavailable right now.");
  const json = await res.json().catch(() => null);
  const data = json?.data || {};
  const items = (Array.isArray(data.data) ? data.data : []).map((i) => mapItem(i, kind)).filter(Boolean);
  const value = { items, page: data.current_page || page, hasNext: Boolean(data.has_next) };

  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, { value, exp: Date.now() + CACHE_TTL_MS });
  return value;
}
