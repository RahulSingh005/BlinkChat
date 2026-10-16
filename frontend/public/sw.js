/* BlinkChat service worker: offline app shell, push notifications. */
const BUILD = "__BUILD_ID__";
const SHELL_CACHE = `blinkchat-shell-${BUILD}`;
const ASSET_CACHE = "blinkchat-assets-v1";
const MEDIA_CACHE = "blinkchat-media-v1";
const MEDIA_LIMIT = 250;

const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg", "/theme-init.js", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("blinkchat-shell-") && k !== SHELL_CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i += 1) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io")) return;

  // App navigations: network first, fall back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/index.html", fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          return (await caches.match("/index.html")) || (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) (await caches.open(ASSET_CACHE)).put(request, res.clone()).catch(() => {});
        return res;
      })()
    );
    return;
  }

  // Uploaded images use random, immutable names: cache first (bounded).
  if (url.pathname.startsWith("/uploads/") && /\.(jpe?g|png|webp|gif|avif)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open(MEDIA_CACHE);
          await cache.put(request, res.clone()).catch(() => {});
          trimCache(MEDIA_CACHE, MEDIA_LIMIT);
        }
        return res;
      })()
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "BlinkChat", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = windows.some((w) => w.visibilityState === "visible");
      // The open app already shows its own in-app notification.
      if (visible && (data.type === "message" || data.type === "call" || data.type === "reminder")) return;

      await self.registration.showNotification(data.title || "BlinkChat", {
        body: data.body || "",
        icon: data.icon || "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        requireInteraction: Boolean(data.requireInteraction),
        vibrate: data.type === "call" ? [300, 150, 300, 150, 300] : [80, 40, 80],
        data: { url: data.url || "/chat", conversationId: data.conversationId || null },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/chat", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const win of windows) {
        if (new URL(win.url).origin === self.location.origin) {
          await win.focus();
          win.postMessage({ type: "navigate", url: target });
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
