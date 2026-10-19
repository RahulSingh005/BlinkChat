/**
 * Accent colors. Each accent has a tuned value per theme so it stays
 * readable: dark mode gets a slightly lighter UI accent and a deeper
 * outgoing-bubble color (white text stays comfortable at night).
 *
 * Values are OKLCH "L C H" triplets as DaisyUI expects in --p.
 * Keep public/theme-init.js in sync (it applies these before first paint).
 */
export const ACCENTS = {
  blue: { label: "Blue", swatch: "#3B5BFD", h: 267, light: "55.5% 0.236 267", dark: "64% 0.19 267", bubbleDark: "49% 0.2 267" },
  violet: { label: "Violet", swatch: "#7C3AED", h: 293, light: "54% 0.246 293", dark: "64% 0.2 293", bubbleDark: "47% 0.21 293" },
  emerald: { label: "Green", swatch: "#0F8A5F", h: 163, light: "52% 0.115 163", dark: "66% 0.13 163", bubbleDark: "42% 0.08 170" },
  rose: { label: "Rose", swatch: "#E11D48", h: 17, light: "58% 0.22 17", dark: "65% 0.2 17", bubbleDark: "50% 0.17 17" },
  orange: { label: "Orange", swatch: "#EA580C", h: 45, light: "60% 0.19 41", dark: "70% 0.17 50", bubbleDark: "52% 0.15 42" },
  teal: { label: "Teal", swatch: "#0B8178", h: 186, light: "54% 0.093 186", dark: "67% 0.1 186", bubbleDark: "44% 0.07 190" },
  mono: { label: "Graphite", swatch: "#27272A", h: 0, mono: true },
};

export const BUBBLE_STYLES = { solid: "Solid", soft: "Soft" };

/** CSS variables for an accent in a theme: primary, its text, and bubbles. */
export function accentVars(key, dark, bubbleStyle = "solid") {
  const a = ACCENTS[key] || ACCENTS.blue;
  const soft = bubbleStyle === "soft";
  if (a.mono) {
    return dark
      ? { p: "92% 0 0", pc: "18% 0 0", bo: soft ? "30% 0 0" : "34% 0 0", boc: "98% 0 0", tick: "86% 0.11 215" }
      : { p: "24% 0 0", pc: "100% 0 0", bo: soft ? "91% 0 0" : "26% 0 0", boc: soft ? "18% 0 0" : "100% 0 0", tick: soft ? "55% 0.15 240" : "86% 0.11 215" };
  }
  const p = dark ? a.dark : a.light;
  if (soft) {
    return dark
      ? { p, pc: "100% 0 0", bo: `33% 0.055 ${a.h}`, boc: "96% 0.01 0", tick: `74% 0.13 ${a.h}` }
      : { p, pc: "100% 0 0", bo: `93% 0.045 ${a.h}`, boc: "20% 0.02 0", tick: `55% 0.2 ${a.h}` };
  }
  return { p, pc: "100% 0 0", bo: dark ? a.bubbleDark : a.light, boc: "100% 0 0", tick: "86% 0.11 215" };
}

/** Browser chrome color (Android status bar, installed PWA title bar). */
export const chromeColor = (dark) => (dark ? "#18181b" : "#ffffff");
