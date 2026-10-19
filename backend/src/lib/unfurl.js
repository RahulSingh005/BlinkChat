import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { env } from "../config/env.js";
import { storeUpload } from "./storage.js";

/**
 * Link previews (title, description, image) fetched server-side with SSRF
 * protection: http(s) only, every hop's DNS answer is checked against
 * private/reserved ranges, redirects are re-validated, and responses are
 * size- and time-limited. The preview image is copied to our own storage so
 * recipients' browsers never contact the third-party site (no IP leaks).
 */
const MAX_HTML_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 900 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const UA = "Mozilla/5.0 (compatible; BlinkChatBot/2.0; +https://github.com/) link-preview";

const blocked = new net.BlockList();
for (const [net4, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  blocked.addSubnet(net4, prefix, "ipv4");
}
for (const [net6, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["64:ff9b::", 96],
]) {
  blocked.addSubnet(net6, prefix, "ipv6");
}

const allowPrivate = () => env.isTest || process.env.LINK_PREVIEW_ALLOW_PRIVATE === "true";

function isBlockedAddress(address, family) {
  if (allowPrivate()) return false;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  return blocked.check(address, family === 6 ? "ipv6" : "ipv4");
}

function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("bad url");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad protocol");
  if (url.username || url.password) throw new Error("credentials in url");
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port) && !allowPrivate()) throw new Error("bad port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // IP literals skip DNS, so check them here; hostnames are checked in
  // safeLookup at connect time (no DNS-rebinding window).
  if (net.isIP(host) && isBlockedAddress(host, net.isIP(host))) throw new Error("private address");
  return url;
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }).then(
    (addresses) => {
      if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address, a.family))) {
        callback(new Error("private address"));
      } else if (options?.all) {
        callback(null, addresses);
      } else {
        callback(null, addresses[0].address, addresses[0].family);
      }
    },
    (err) => callback(err)
  );
}

function requestOnce(url, { accept, maxBytes }) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.get(
      url,
      {
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en;q=0.9,*;q=0.5", "Accept-Encoding": "gzip, deflate, br" },
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({ redirect: res.headers.location });
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`status ${status}`));
          return;
        }
        const length = Number(res.headers["content-length"] || 0);
        if (length && length > maxBytes * 4) {
          res.destroy();
          reject(new Error("too large"));
          return;
        }
        const encoding = String(res.headers["content-encoding"] || "").toLowerCase();
        const stream =
          encoding === "gzip" ? res.pipe(zlib.createGunzip()) : encoding === "deflate" ? res.pipe(zlib.createInflate()) : encoding === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
        const chunks = [];
        let total = 0;
        stream.on("data", (chunk) => {
          total += chunk.length;
          if (total > maxBytes) {
            res.destroy();
            stream.destroy?.();
            resolve({ url, contentType: String(res.headers["content-type"] || ""), body: Buffer.concat(chunks), truncated: true });
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ url, contentType: String(res.headers["content-type"] || ""), body: Buffer.concat(chunks) }));
        stream.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function safeFetch(raw, { accept, maxBytes }) {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = assertPublicUrl(current);
    const res = await requestOnce(url, { accept, maxBytes });
    if (res.redirect) {
      current = new URL(res.redirect, url).toString();
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}

const decode = (s = "") =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();

function metaContent(html, names) {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
    const tag = re.exec(html)?.[0];
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return decode(content);
  }
  return "";
}

export const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,:;!?)\]}]/i;

export function firstUrl(text = "") {
  const m = URL_IN_TEXT.exec(text);
  return m ? m[0] : null;
}

const cache = new Map();

/** Returns { url, title, description, image, siteName } or null. Never throws. */
export async function unfurl(rawUrl) {
  const key = rawUrl.slice(0, 500);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;

  let value = null;
  try {
    const page = await safeFetch(rawUrl, { accept: "text/html,application/xhtml+xml", maxBytes: MAX_HTML_BYTES });
    if (/text\/html|application\/xhtml/i.test(page.contentType)) {
      const html = page.body.toString("utf8").slice(0, MAX_HTML_BYTES);
      const head = html.split(/<\/head>/i)[0] || html;
      const title = metaContent(head, ["og:title", "twitter:title"]) || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] || "");
      const description = metaContent(head, ["og:description", "twitter:description", "description"]);
      const siteName = metaContent(head, ["og:site_name"]) || page.url.hostname.replace(/^www\./, "");
      const imageRaw = metaContent(head, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
      let image = "";
      if (imageRaw) {
        try {
          const imageUrl = new URL(imageRaw, page.url).toString();
          const img = await safeFetch(imageUrl, { accept: "image/*", maxBytes: MAX_IMAGE_BYTES });
          if (/^image\/(jpeg|png|webp|gif)/i.test(img.contentType) && img.body.length < MAX_IMAGE_BYTES) {
            const stored = await storeUpload({ buffer: img.body, mime: img.contentType.split(";")[0], originalName: "preview", purpose: "preview" });
            image = stored.url;
          }
        } catch {
          // preview without image
        }
      }
      if (title || description) {
        value = {
          url: page.url.toString().slice(0, 600),
          title: title.slice(0, 200),
          description: description.slice(0, 300),
          image,
          siteName: siteName.slice(0, 80),
        };
      }
    }
  } catch {
    value = null;
  }
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(key, { value, exp: Date.now() + 30 * 60 * 1000 });
  return value;
}
