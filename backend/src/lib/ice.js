import { env } from "../config/env.js";

/**
 * ICE servers for WebRTC calls. STUN finds a direct path; TURN relays media
 * when a direct path is impossible (mobile data, strict NATs, corporate
 * Wi-Fi). Without TURN those calls "connect" but carry no audio/video.
 *
 * Supported (first match wins):
 *  - Metered.ca (free 20 GB/month):   METERED_DOMAIN + METERED_API_KEY
 *  - Cloudflare TURN:                  CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
 *  - Any TURN server (e.g. coturn):    TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL
 */
const STUN_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
];

let cache = { servers: null, expiresAt: 0 };

export const turnProvider = () => {
  if (env.METERED_DOMAIN && env.METERED_API_KEY) return "metered";
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) return "cloudflare";
  if (env.TURN_URLS.length && env.TURN_USERNAME && env.TURN_CREDENTIAL) return "static";
  return null;
};

async function fetchTurn() {
  const provider = turnProvider();
  if (provider === "metered") {
    const url = `https://${env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_API_KEY)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Metered responded ${res.status}`);
    const servers = await res.json();
    return { servers: Array.isArray(servers) ? servers : [], ttlMs: 6 * 60 * 60 * 1000 };
  }
  if (provider === "cloudflare") {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.CLOUDFLARE_TURN_KEY_ID)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 86400 }),
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) throw new Error(`Cloudflare responded ${res.status}`);
    const json = await res.json();
    return { servers: Array.isArray(json?.iceServers) ? json.iceServers : [], ttlMs: 12 * 60 * 60 * 1000 };
  }
  if (provider === "static") {
    return {
      servers: [{ urls: env.TURN_URLS, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }],
      ttlMs: 24 * 60 * 60 * 1000,
    };
  }
  return { servers: [], ttlMs: 24 * 60 * 60 * 1000 };
}

export async function getIceServers() {
  if (cache.servers && cache.expiresAt > Date.now()) return cache.servers;
  try {
    const { servers, ttlMs } = await fetchTurn();
    cache = { servers: [...STUN_SERVERS, ...servers], expiresAt: Date.now() + ttlMs };
  } catch (err) {
    console.warn("[calls] Could not fetch TURN credentials:", err.message);
    // Retry soon instead of caching the failure for hours.
    cache = { servers: STUN_SERVERS, expiresAt: Date.now() + 60 * 1000 };
  }
  return cache.servers;
}
