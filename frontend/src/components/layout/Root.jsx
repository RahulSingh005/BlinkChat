import { lazy, Suspense, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import BootScreen from "./BootScreen";
import { useAppViewport } from "../../hooks/useAppViewport";
import { unlockAudio } from "../../lib/sound";
import { useAuthStore } from "../../store/useAuthStore";
import { selectTotalUnread, useChatStore } from "../../store/useChatStore";
import { useConfigStore } from "../../store/useConfigStore";

const CallOverlay = lazy(() => import("../call/CallOverlay"));
const GlobalDialogs = lazy(() => import("../chat/GlobalDialogs"));

/** App-wide effects and overlays shared by every route. */
export default function Root() {
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const totalUnread = useChatStore(selectTotalUnread);
  useAppViewport();

  useEffect(() => {
    useConfigStore.getState().load();
    useAuthStore.getState().checkAuth();
  }, []);

  // Browsers block audio until the first interaction.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Tab visibility drives push decisions server-side and read receipts.
  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      useAuthStore.getState().socket?.emit("visibility", { visible });
      const active = useChatStore.getState().activeId;
      if (visible && active) useChatStore.getState().markRead(active);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  // Notification taps from the service worker.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const onMessage = (e) => {
      if (e.data?.type === "navigate" && e.data.url) {
        const url = new URL(e.data.url, window.location.origin);
        navigate(url.pathname + url.search);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);

  // Housekeeping: stale typing indicators and expired disappearing messages.
  useEffect(() => {
    const typing = setInterval(() => useChatStore.getState().pruneTyping(), 2000);
    const expired = setInterval(() => useChatStore.getState().pruneExpired(), 15000);
    const online = () => useChatStore.getState().flushOutbox();
    window.addEventListener("online", online);
    return () => {
      clearInterval(typing);
      clearInterval(expired);
      window.removeEventListener("online", online);
    };
  }, []);

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread > 99 ? "99+" : totalUnread}) BlinkChat` : "BlinkChat";
  }, [totalUnread]);

  return (
    <>
      <Suspense fallback={<BootScreen />}>
        <Outlet />
      </Suspense>

      {status === "authenticated" && (
        <Suspense fallback={null}>
          <CallOverlay />
          <GlobalDialogs />
        </Suspense>
      )}
      <ConfirmDialog />
      <Toaster
        position="top-center"
        gutter={8}
        containerStyle={{ top: "max(12px, env(safe-area-inset-top))" }}
        toastOptions={{ className: "bc-toast", duration: 3500 }}
      />
    </>
  );
}
