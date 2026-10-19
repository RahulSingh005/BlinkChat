import { create } from "zustand";
import { storage } from "../lib/storage";

/**
 * App lock: a device-local PIN that hides BlinkChat until it's entered
 * (like WhatsApp's app lock / Telegram's passcode). The PIN is stored only
 * as a salted PBKDF2 hash in this browser.
 */
const keyFor = (userId) => `blinkchat.lock.${userId}`;
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function derive(pin, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, key, 256);
  return toHex(bits);
}

export const AUTO_LOCK = [
  { ms: 0, label: "Immediately" },
  { ms: 60 * 1000, label: "After 1 minute" },
  { ms: 5 * 60 * 1000, label: "After 5 minutes" },
  { ms: 60 * 60 * 1000, label: "After 1 hour" },
];

export const useLockStore = create((set, get) => ({
  userId: null,
  config: null, // { salt, hash, autoLockMs }
  locked: false,
  hiddenAt: 0,

  /** Called when a user signs in: locks right away if they set a PIN. */
  load: (userId) => {
    const config = userId ? storage.get(keyFor(userId), null) : null;
    set({ userId, config, locked: Boolean(config) });
  },

  enable: async (pin, autoLockMs = 60 * 1000) => {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const config = { salt, hash: await derive(pin, salt), autoLockMs };
    storage.set(keyFor(get().userId), config);
    set({ config });
  },

  setAutoLock: (autoLockMs) => {
    const config = { ...get().config, autoLockMs };
    storage.set(keyFor(get().userId), config);
    set({ config });
  },

  disable: () => {
    storage.remove(keyFor(get().userId));
    set({ config: null, locked: false });
  },

  verify: async (pin) => {
    const { config } = get();
    if (!config) return true;
    return (await derive(pin, config.salt)) === config.hash;
  },

  unlock: () => set({ locked: false }),
  lockNow: () => get().config && set({ locked: true }),

  onHidden: () => set({ hiddenAt: Date.now() }),
  onVisible: () => {
    const { config, hiddenAt } = get();
    if (config && hiddenAt && Date.now() - hiddenAt >= (config.autoLockMs ?? 60000)) set({ locked: true });
    set({ hiddenAt: 0 });
  },

  reset: () => set({ userId: null, config: null, locked: false, hiddenAt: 0 }),
}));
