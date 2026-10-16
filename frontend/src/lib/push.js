import { api } from "./api";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

let registration = null;

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
  try {
    registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return registration;
  } catch (err) {
    console.warn("[sw] registration failed", err);
    return null;
  }
}

const getRegistration = async () => registration || (await navigator.serviceWorker.ready);

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const sameKey = (buffer, base64) => {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  const b = urlBase64ToUint8Array(base64);
  return a.length === b.length && a.every((v, i) => v === b[i]);
};

/** "unsupported" | "denied" | "enabled" | "disabled" */
export async function pushStatus() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await getRegistration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "enabled" : "disabled";
}

export async function enablePush(vapidPublicKey) {
  if (!pushSupported()) throw new Error("This browser doesn't support push notifications.");
  if (!vapidPublicKey) throw new Error("Push notifications aren't configured on the server.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser settings.");

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  // The server's key changed (e.g. redeploy without fixed VAPID keys).
  if (sub && !sameKey(sub.options?.applicationServerKey, vapidPublicKey)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  await api.post("/push/subscribe", { subscription: sub.toJSON() });
  return sub;
}

/** Re-links this device to the signed-in account (after login / user switch). */
export async function syncPushSubscription(vapidPublicKey) {
  if (!pushSupported() || Notification.permission !== "granted" || !vapidPublicKey) return;
  const reg = await getRegistration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  if (!sameKey(sub.options?.applicationServerKey, vapidPublicKey)) {
    await enablePush(vapidPublicKey).catch(() => {});
    return;
  }
  await api.post("/push/subscribe", { subscription: sub.toJSON() }).catch(() => {});
}

/**
 * Unlinks this device. Called on logout too, so the next person using this
 * browser never receives the previous account's notifications.
 */
export async function disablePush({ keepBrowserSubscription = false } = {}) {
  if (!pushSupported()) return;
  const reg = await getRegistration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
  if (!keepBrowserSubscription) await sub.unsubscribe().catch(() => {});
}
