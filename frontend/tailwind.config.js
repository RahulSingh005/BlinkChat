import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#2563EB",
          "green-dark": "#1D4ED8",
          pink: "#38BDF8",
          purple: "#0EA5E9",
          lavender: "#E0F2FE",
          cream: "#F8FAFC",
          dark: "#0F172A",
          "dark-sidebar": "#0B1220",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "message-in": "message-in 0.25s ease-out",
        float: "float 6s ease-in-out infinite",
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.08)",
        phone: "0 25px 60px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#2563EB",
          "primary-content": "#ffffff",
          secondary: "#0EA5E9",
          "secondary-content": "#ffffff",
          accent: "#38BDF8",
          "accent-content": "#0B2540",
          neutral: "#0F172A",
          "neutral-content": "#ffffff",
          "base-100": "#FFFFFF",
          "base-200": "#F0F6FF",
          "base-300": "#DCEBFF",
          "base-content": "#0F172A",
          info: "#38BDF8",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
        },
      },
      {
        dark: {
          primary: "#6366F1",
          "primary-content": "#F5F3FF",
          secondary: "#22D3EE",
          "secondary-content": "#04252B",
          accent: "#38BDF8",
          "accent-content": "#031B2E",
          neutral: "#CBD5E1",
          "neutral-content": "#0A0F1E",
          "base-100": "#0A0E1A",
          "base-200": "#0F1524",
          "base-300": "#1B2337",
          "base-content": "#E7EBF5",
          info: "#38BDF8",
          success: "#34D399",
          warning: "#FBBF24",
          error: "#F87171",
        },
      },
    ],
    darkTheme: "dark",
  },
};
