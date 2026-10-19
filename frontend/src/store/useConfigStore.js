import { create } from "zustand";
import { api } from "../lib/api";

/** Runtime configuration served by the backend (/api/config). */
export const useConfigStore = create((set, get) => ({
  config: null,
  loaded: false,
  unreachable: false, // the API couldn't be reached (down, or blocked by CORS)

  load: async () => {
    if (get().loaded) return get().config;
    try {
      const res = await api.get("/config", { skipAuthHandler: true });
      // An HTML page instead of JSON means VITE_API_URL points at the wrong place.
      if (!res.data || typeof res.data !== "object") throw new Error("bad config");
      set({ config: res.data, loaded: true, unreachable: false });
      return res.data;
    } catch {
      set({ loaded: true, unreachable: true });
      return null;
    }
  },
}));

// Stable fallback: a fresh {} on every call makes React re-render forever
// (this crashed the login page whenever the API was unreachable).
const NO_FEATURES = Object.freeze({});
export const useFeatures = () => useConfigStore((s) => s.config?.features || NO_FEATURES);
export const useAiEnabled = () => useConfigStore((s) => Boolean(s.config?.features?.ai?.enabled));
export const useGoogleEnabled = () =>
  useConfigStore((s) => Boolean(s.config?.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID));

export const googleClientId = () =>
  useConfigStore.getState().config?.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
