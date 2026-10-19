import { create } from "zustand";
import { storage } from "../lib/storage";
import { isTouchDevice } from "../lib/platform";
import { ACCENTS, BUBBLE_STYLES, accentVars, chromeColor } from "../lib/theme";

const KEY = "blinkchat.settings";

export { ACCENTS, BUBBLE_STYLES };
export const FONT_SIZES = { sm: "Small", md: "Default", lg: "Large", xl: "Extra large" };
export const WALLPAPERS = { doodle: "Doodles", dots: "Dots", gradient: "Soft glow", plain: "Plain" };

const defaults = () => ({
  theme: "system", // light | dark | system
  accent: "blue",
  bubbleStyle: "solid", // solid | soft
  fontSize: "md",
  wallpaper: "doodle",
  enterToSend: !isTouchDevice(),
  sounds: true,
  desktopNotifications: true,
  smartReplies: true,
  linkPreviews: true,
  autoplayGifs: true,
  autoTranslate: {}, // conversationId -> true
});

const PERSISTED = Object.keys(defaults());

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export const resolveTheme = (pref) => (pref === "dark" || (pref === "system" && systemDark()) ? "blinkdark" : "blink");

function applyToDocument(state) {
  const root = document.documentElement;
  const theme = resolveTheme(state.theme);
  const dark = theme === "blinkdark";
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-font", state.fontSize);
  const vars = accentVars(state.accent, dark, state.bubbleStyle);
  root.style.setProperty("--p", vars.p);
  root.style.setProperty("--pc", vars.pc);
  root.style.setProperty("--bo", vars.bo);
  root.style.setProperty("--boc", vars.boc);
  root.style.setProperty("--tick", vars.tick);
  // Keep the browser chrome (Android status bar, iOS PWA) in sync.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", chromeColor(dark)));
  return theme;
}

const saved = storage.get(KEY, {});
if (saved.accent && !ACCENTS[saved.accent]) delete saved.accent;
if (saved.wallpaper && !WALLPAPERS[saved.wallpaper]) delete saved.wallpaper;

export const useSettingsStore = create((set, get) => ({
  ...defaults(),
  ...saved,
  resolvedTheme: "blink",

  init: () => {
    const resolvedTheme = applyToDocument(get());
    set({ resolvedTheme });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (get().theme === "system") set({ resolvedTheme: applyToDocument(get()) });
    });
  },

  update: (patch) => {
    set(patch);
    const state = get();
    storage.set(KEY, Object.fromEntries(PERSISTED.map((k) => [k, state[k]])));
    if (["theme", "accent", "fontSize", "bubbleStyle"].some((k) => k in patch)) set({ resolvedTheme: applyToDocument(state) });
  },

  setAutoTranslate: (conversationId, on) => {
    const next = { ...get().autoTranslate };
    if (on) next[conversationId] = true;
    else delete next[conversationId];
    get().update({ autoTranslate: next });
  },
}));
