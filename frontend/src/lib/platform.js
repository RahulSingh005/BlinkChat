const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

export const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document);
export const isAndroid = /Android/i.test(ua);
export const isMac = /Mac/.test(ua) && !isIOS;

export const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const vibrate = (pattern = 8) => {
  try {
    if (!prefersReducedMotion()) navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
};

export const modKey = isMac ? "⌘" : "Ctrl";
