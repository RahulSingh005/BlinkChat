import daisyui from "daisyui";

const shared = {
  "--rounded-box": "1rem",
  "--rounded-btn": "0.75rem",
  "--rounded-badge": "1.9rem",
  "--animation-btn": "0.18s",
  "--btn-focus-scale": "0.97",
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // `dark:` utilities follow the active DaisyUI theme, not the OS setting.
  darkMode: ["selector", '[data-theme="blinkdark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Chat surfaces, defined per theme (and accent) in index.css / settings.
        "bubble-in": "rgb(var(--bubble-in) / <alpha-value>)",
        "bubble-out": "oklch(var(--bo) / <alpha-value>)",
        "bubble-out-content": "oklch(var(--boc) / <alpha-value>)",
        "chat-bg": "rgb(var(--chat-bg) / <alpha-value>)",
        rail: "rgb(var(--rail) / <alpha-value>)",
      },
      spacing: {
        header: "3.75rem", // 60px: every panel header shares this height
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.06)",
        float: "0 12px 40px -12px rgb(0 0 0 / 0.35)",
        bubble: "0 1px 0.5px rgb(0 0 0 / 0.13)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "message-in": { from: { opacity: "0", transform: "translateY(6px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        highlight: { "0%, 100%": { backgroundColor: "transparent" }, "30%": { backgroundColor: "oklch(var(--p) / 0.16)" } },
        "pulse-ring": { "0%": { transform: "scale(0.9)", opacity: "0.7" }, "100%": { transform: "scale(1.6)", opacity: "0" } },
        typing: { "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.45" }, "30%": { transform: "translateY(-3px)", opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "slide-up": "slide-up 0.22s ease-out",
        "scale-in": "scale-in 0.16s ease-out",
        "sheet-up": "sheet-up 0.26s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "message-in": "message-in 0.2s ease-out",
        highlight: "highlight 1.6s ease-in-out",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        typing: "typing 1.3s ease-in-out infinite",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        // Light: clean whites on a soft neutral canvas.
        blink: {
          primary: "#3B5BFD",
          "primary-content": "#FFFFFF",
          secondary: "#0EA5E9",
          "secondary-content": "#FFFFFF",
          accent: "#7C3AED",
          "accent-content": "#FFFFFF",
          neutral: "#1F2125",
          "neutral-content": "#F7F7F8",
          "base-100": "#FFFFFF",
          "base-200": "#F2F3F5",
          "base-300": "#E3E5E8",
          "base-content": "#111317",
          info: "#0EA5E9",
          success: "#16A34A",
          warning: "#D97706",
          error: "#DC2626",
          ...shared,
        },
      },
      {
        // Dark: neutral graphite (no blue cast), like modern messengers.
        blinkdark: {
          primary: "#6F86FF",
          "primary-content": "#FFFFFF",
          secondary: "#38BDF8",
          "secondary-content": "#04131D",
          accent: "#A78BFA",
          "accent-content": "#140A2A",
          neutral: "#E4E4E7",
          "neutral-content": "#18181B",
          "base-100": "#18181B",
          "base-200": "#111113",
          "base-300": "#2A2A2F",
          "base-content": "#ECECEF",
          info: "#60A5FA",
          success: "#34D399",
          warning: "#FBBF24",
          error: "#F87171",
          ...shared,
        },
      },
    ],
    darkTheme: "blinkdark",
    logs: false,
  },
};
