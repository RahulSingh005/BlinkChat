import { create } from "zustand";
import { storage } from "../lib/storage";
import { isTouchDevice } from "../lib/platform";

const KEY = "blinkchat.settings";

export const ACCENTS = {
  blue: { label: "Blue", value: null, swatch: "#3B5BFD" },
  violet: { label: "Violet", value: "54.13% 0.2466 293.01", swatch: "#7C3AED" },
  emerald: { label: "Emerald", value: "50.81% 0.1049 165.61", swatch: "#047857" },
  rose: { label: "Rose", value: "58.58% 0.2220 17.58", swatch: "#E11D48" },
  orange: { label: "Orange", value: "55.34% 0.1739 38.40", swatch: "#C2410C" },
  teal: { label: "Teal", value: "54.39% 0.0932 186.17", swatch: "#0B8178" },
};

export const FONT_SIZES = { sm: "Small", md: "Default", lg: "Large", xl: "Extra large" };
export const WALLPAPERS = { doodle: "Doodles", gradient: "Soft gradient", plain: "Plain" };

const defaults = () => ({
  theme: "system", // light | dark | system
  accent: "blue",
  fontSize: "md",
  wallpaper: "doodle",
  enterToSend: !isTouchDevice(),
  sounds: true,
  desktopNotifications: true,
  smartReplies: true,
  autoTranslate: {}, // conversationId -> true
});

const PERSISTED = Object.keys(defaults());

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export const resolveTheme = (pref) => (pref === "dark" || (pref === "system" && systemDark()) ? "blinkdark" : "blink");

function applyToDocument(state) {
  const root = document.documentElement;
  const theme = resolveTheme(state.theme);
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-font", state.fontSize);
  const accent = ACCENTS[state.accent]?.value;
  if (accent) root.style.setProperty("--p", accent);
  else root.style.removeProperty("--p");
  // Keep the browser chrome (Android status bar, iOS PWA) in sync.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", theme === "blinkdark" ? "#0a0e19" : "#f4f6fb"));
  return theme;
}

export const useSettingsStore = create((set, get) => ({
  ...defaults(),
  ...storage.get(KEY, {}),
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
    if ("theme" in patch || "accent" in patch || "fontSize" in patch) set({ resolvedTheme: applyToDocument(state) });
  },

  setAutoTranslate: (conversationId, on) => {
    const next = { ...get().autoTranslate };
    if (on) next[conversationId] = true;
    else delete next[conversationId];
    get().update({ autoTranslate: next });
  },
}));
