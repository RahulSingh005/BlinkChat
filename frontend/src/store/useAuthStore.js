import { create } from "zustand";
import toast from "react-hot-toast";
import { api, onUnauthorized, setSocketIdGetter, tokenStore } from "../lib/api";
import { disablePush, syncPushSubscription } from "../lib/push";
import { createSocket } from "../lib/socket";
import { storage } from "../lib/storage";
import { myTimezone } from "../lib/time";
import { bindRealtime, resetSessionStores } from "./realtime";
import { useConfigStore } from "./useConfigStore";

export const PUSH_OWNER_KEY = "blinkchat.pushOwner";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  status: "checking", // checking | authenticated | guest
  socket: null,
  connection: "idle", // idle | connecting | connected | reconnecting
  presence: {}, // userId -> { online, lastSeen, since }

  checkAuth: async () => {
    try {
      const res = await api.get("/auth/check", { skipAuthHandler: true });
      get()._onAuthenticated(res.data.user);
    } catch {
      set({ authUser: null, status: "guest" });
    }
  },

  _onAuthenticated: (user) => {
    set({ authUser: user, status: "authenticated" });
    get().connectSocket();

    // Keep "their local time" accurate when people travel.
    const tz = myTimezone();
    if (tz && tz !== user.timezone && !storage.get("blinkchat.tzManual")) {
      api
        .put("/auth/profile", { timezone: tz })
        .then((res) => set({ authUser: res.data.user }))
        .catch(() => {});
    }
    if (storage.get(PUSH_OWNER_KEY) === user._id) {
      syncPushSubscription(useConfigStore.getState().config?.vapidPublicKey);
    }
  },

  signup: async ({ fullName, email, password }) => {
    const res = await api.post("/auth/signup", { fullName, email, password, timezone: myTimezone() });
    get()._onAuthenticated(res.data.user);
    return res.data.user;
  },

  login: async ({ email, password }) => {
    const res = await api.post("/auth/login", { email, password });
    get()._onAuthenticated(res.data.user);
    return res.data.user;
  },

  googleAuth: async (credential) => {
    const res = await api.post("/auth/google", { credential, timezone: myTimezone() });
    get()._onAuthenticated(res.data.user);
    return res.data.user;
  },

  logout: async ({ everywhere = false } = {}) => {
    // Unlink this device first so the next person here gets no notifications.
    await disablePush().catch(() => {});
    try {
      await api.post(everywhere ? "/auth/logout-all" : "/auth/logout", null, { skipAuthHandler: true });
    } catch {
      // still clear the local session
    }
    get()._clearSession();
  },

  _clearSession: () => {
    tokenStore.clear();
    get().disconnectSocket();
    resetSessionStores();
    set({ authUser: null, status: "guest", presence: {} });
  },

  setUser: (patch) => set((s) => ({ authUser: s.authUser ? { ...s.authUser, ...patch } : s.authUser })),

  updateProfile: async (patch) => {
    const res = await api.put("/auth/profile", patch);
    set({ authUser: res.data.user });
    return res.data.user;
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    const res = await api.put("/auth/password", { currentPassword, newPassword });
    set({ authUser: res.data.user });
  },

  deleteAccount: async ({ password, deleteMessages }) => {
    await api.delete("/auth/account", { data: { password, confirm: "DELETE", deleteMessages } });
    await disablePush().catch(() => {});
    get()._clearSession();
  },

  setPresence: (userId, value) =>
    set((s) => ({ presence: { ...s.presence, [userId]: { ...s.presence[userId], ...value } } })),

  connectSocket: () => {
    if (get().socket) return;
    const socket = createSocket();
    set({ socket, connection: "connecting" });
    setSocketIdGetter(() => socket.id);
    bindRealtime(socket);
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.removeAllListeners();
      socket.io.removeAllListeners?.();
      socket.disconnect();
    }
    setSocketIdGetter(() => null);
    set({ socket: null, connection: "idle" });
  },
}));

export const useIsOnline = (userId) => useAuthStore((s) => Boolean(userId && s.presence[userId]?.online));

// Any API call answered with 401 (expired or revoked session) signs out.
onUnauthorized(() => {
  const { status, _clearSession } = useAuthStore.getState();
  if (status !== "authenticated") return;
  _clearSession();
  toast.error("Your session ended. Please sign in again.");
});
