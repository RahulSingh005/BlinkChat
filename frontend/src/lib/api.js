import axios from "axios";
import { storage } from "./storage";

/**
 * API location. Leave VITE_API_URL empty when the backend serves the
 * frontend (recommended) or in development (Vite proxies /api). Set it to
 * the backend URL only when the frontend is hosted elsewhere (e.g. Vercel).
 */
const RAW = (import.meta.env.VITE_API_URL || "").trim();
export const API_ORIGIN = RAW.replace(/\/api\/?$/, "").replace(/\/+$/, "");
export const API_BASE = `${API_ORIGIN}/api`;

export const CROSS_ORIGIN = (() => {
  if (!API_ORIGIN) return false;
  try {
    return new URL(API_ORIGIN, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
})();

// Cross-site cookies are blocked by Safari/iOS (and increasingly others), so
// a frontend on another domain authenticates with a bearer token instead.
const TOKEN_KEY = "blinkchat.token";
export const tokenStore = {
  get: () => (CROSS_ORIGIN ? storage.get(TOKEN_KEY) : null),
  set: (token) => {
    if (CROSS_ORIGIN && token) storage.set(TOKEN_KEY, token);
  },
  clear: () => storage.remove(TOKEN_KEY),
};

let socketIdGetter = () => null;
export const setSocketIdGetter = (fn) => {
  socketIdGetter = fn;
};

let unauthorizedHandler = () => {};
export const onUnauthorized = (fn) => {
  unauthorizedHandler = fn;
};

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 30000,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (CROSS_ORIGIN) config.headers["X-Auth-Mode"] = "token";
  const socketId = socketIdGetter();
  if (socketId) config.headers["X-Socket-Id"] = socketId;
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.data?.token) tokenStore.set(res.data.token);
    return res;
  },
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAuthHandler) unauthorizedHandler(error);
    return Promise.reject(error);
  }
);

/** Human-readable message for any API/network error. */
export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === "ECONNABORTED") return "The request took too long. Please try again.";
  if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
    return navigator.onLine ? "Can't reach BlinkChat right now. Please try again." : "You're offline. Check your connection.";
  }
  return fallback;
}

/** Uploaded files are stored with relative URLs; resolve them against the API. */
export const mediaUrl = (url) => {
  if (!url) return "";
  return url.startsWith("/") ? `${API_ORIGIN}${url}` : url;
};

/** Cloudinary images can be resized on the fly; other URLs pass through. */
export const imageVariant = (url, width) => {
  const full = mediaUrl(url);
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(full)) return full;
  return full.replace("/image/upload/", `/image/upload/c_limit,w_${width},q_auto,f_auto/`);
};
