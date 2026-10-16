import { io } from "socket.io-client";
import { API_ORIGIN, tokenStore } from "./api";

/**
 * One authenticated socket per tab. The server identifies us from the
 * session cookie (or bearer token for cross-site frontends) — never from a
 * client-supplied user id. `auth` is re-evaluated on every reconnect.
 */
export function createSocket() {
  return io(API_ORIGIN || undefined, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    auth: (cb) =>
      cb({
        token: tokenStore.get() || undefined,
        visible: document.visibilityState === "visible",
      }),
  });
}
