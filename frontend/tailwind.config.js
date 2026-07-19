import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#25D366",
          "green-dark": "#128C7E",
          pink: "#FF639B",
          purple: "#8B5CF6",
          lavender: "#EDE9FE",
          cream: "#F5F5F0",
          dark: "#1A1A2E",
          "dark-sidebar": "#14141F",
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
          primary: "#FF639B",
          "primary-content": "#ffffff",
          secondary: "#8B5CF6",
          "secondary-content": "#ffffff",
          accent: "#25D366",
          "accent-content": "#ffffff",
          neutral: "#1A1A2E",
          "base-100": "#FFFFFF",
          "base-200": "#F8F8FC",
          "base-300": "#E8E8F0",
          "base-content": "#1A1A2E",
        },
      },
      "dark",
      "cupcake",
      "emerald",
      "dracula",
      "nord",
      "pastel",
      "aqua",
      "lofi",
      "night",
      "dim",
    ],
  },
};
