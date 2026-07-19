import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: "light", // default until loaded
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-theme", theme);
    }
    set({ theme });

    // Optional: update global data-theme
    document.documentElement.setAttribute("data-theme", theme);
  },
  initTheme: () => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("chat-theme") || "light";
      set({ theme: storedTheme });
      document.documentElement.setAttribute("data-theme", storedTheme);
    }
  },
}));
