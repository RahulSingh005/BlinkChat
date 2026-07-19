import { create } from "zustand";

const FONT_SIZES = ["sm", "md", "lg", "xl"];

export const useThemeStore = create((set) => ({
  theme: "light", // default until loaded
  fontSize: "md",
  notificationsEnabled: true,
  soundEnabled: true,

  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-theme", theme);
    }
    set({ theme });
    document.documentElement.setAttribute("data-theme", theme);
  },

  setFontSize: (fontSize) => {
    if (!FONT_SIZES.includes(fontSize)) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-font-size", fontSize);
    }
    set({ fontSize });
    document.documentElement.setAttribute("data-font-size", fontSize);
  },

  setNotificationsEnabled: (enabled) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-notifications", enabled ? "1" : "0");
    }
    set({ notificationsEnabled: enabled });
  },

  setSoundEnabled: (enabled) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-sound", enabled ? "1" : "0");
    }
    set({ soundEnabled: enabled });
  },

  initTheme: () => {
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("chat-theme") || "light";
      const storedFontSize = localStorage.getItem("chat-font-size") || "md";
      const storedNotifications = localStorage.getItem("chat-notifications");
      const storedSound = localStorage.getItem("chat-sound");

      set({
        theme: storedTheme,
        fontSize: FONT_SIZES.includes(storedFontSize) ? storedFontSize : "md",
        notificationsEnabled: storedNotifications === null ? true : storedNotifications === "1",
        soundEnabled: storedSound === null ? true : storedSound === "1",
      });

      document.documentElement.setAttribute("data-theme", storedTheme);
      document.documentElement.setAttribute(
        "data-font-size",
        FONT_SIZES.includes(storedFontSize) ? storedFontSize : "md"
      );
    }
  },
}));

export { FONT_SIZES };
