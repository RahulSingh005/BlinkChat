import daisyui from "daisyui";

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
        // Chat-specific surfaces, defined per theme in index.css.
        "bubble-in": "rgb(var(--bubble-in) / <alpha-value>)",
        "bubble-in-border": "rgb(var(--bubble-in-border) / <alpha-value>)",
        "chat-bg": "rgb(var(--chat-bg) / <alpha-value>)",
        rail: "rgb(var(--rail) / <alpha-value>)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px rgb(15 23 42 / 0.06)",
        float: "0 10px 40px -10px rgb(15 23 42 / 0.25)",
        bubble: "0 1px 1.5px rgb(15 23 42 / 0.08)",
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
        blink: {
          primary: "#3B5BFD",
          "primary-content": "#FFFFFF",
          secondary: "#0EA5E9",
          "secondary-content": "#FFFFFF",
          accent: "#7C3AED",
          "accent-content": "#FFFFFF",
          neutral: "#1E293B",
          "neutral-content": "#F8FAFC",
          "base-100": "#FFFFFF",
          "base-200": "#F4F6FB",
          "base-300": "#E5E9F2",
          "base-content": "#0F172A",
          info: "#0EA5E9",
          success: "#16A34A",
          warning: "#D97706",
          error: "#DC2626",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "1.9rem",
          "--animation-btn": "0.18s",
          "--btn-focus-scale": "0.97",
        },
      },
      {
        blinkdark: {
          primary: "#3B5BFD",
          "primary-content": "#FFFFFF",
          secondary: "#38BDF8",
          "secondary-content": "#04131D",
          accent: "#8B5CF6",
          "accent-content": "#FFFFFF",
          neutral: "#CBD5E1",
          "neutral-content": "#0A0E19",
          "base-100": "#0F1422",
          "base-200": "#0A0E19",
          "base-300": "#1E2638",
          "base-content": "#E6E9F2",
          info: "#38BDF8",
          success: "#34D399",
          warning: "#FBBF24",
          error: "#F87171",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "1.9rem",
          "--animation-btn": "0.18s",
          "--btn-focus-scale": "0.97",
        },
      },
    ],
    darkTheme: "blinkdark",
    logs: false,
  },
};
