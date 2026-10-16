import { create } from "zustand";
import { api } from "../lib/api";

/** Runtime configuration served by the backend (/api/config). */
export const useConfigStore = create((set, get) => ({
  config: null,
  loaded: false,

  load: async () => {
    if (get().loaded) return get().config;
    try {
      const res = await api.get("/config", { skipAuthHandler: true });
      set({ config: res.data, loaded: true });
      return res.data;
    } catch {
      set({ loaded: true });
      return null;
    }
  },
}));

export const useFeatures = () => useConfigStore((s) => s.config?.features || {});
export const useAiEnabled = () => useConfigStore((s) => Boolean(s.config?.features?.ai?.enabled));
export const useGoogleEnabled = () =>
  useConfigStore((s) => Boolean(s.config?.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID));

export const googleClientId = () =>
  useConfigStore.getState().config?.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
