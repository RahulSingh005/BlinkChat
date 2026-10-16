import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { errorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";
import { googleClientId, useConfigStore } from "../../store/useConfigStore";
import { useSettingsStore } from "../../store/useSettingsStore";

let scriptPromise = null;
const loadScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
};

/**
 * Official Google button. The client id comes from the backend at runtime,
 * so it only needs to be configured once (GOOGLE_CLIENT_ID in backend/.env).
 * Renders nothing when Google sign-in isn't configured.
 */
export default function GoogleButton({ text = "continue_with" }) {
  const loaded = useConfigStore((s) => s.loaded);
  const dark = useSettingsStore((s) => s.resolvedTheme === "blinkdark");
  const holder = useRef(null);
  const [ready, setReady] = useState(false);
  const clientId = loaded ? googleClientId() : null;

  useEffect(() => {
    if (!clientId || !holder.current) return undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            try {
              await useAuthStore.getState().googleAuth(credential);
            } catch (err) {
              toast.error(errorMessage(err, "Google sign-in failed"));
            }
          },
        });
        holder.current.innerHTML = "";
        window.google.accounts.id.renderButton(holder.current, {
          type: "standard",
          theme: dark ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text,
          width: Math.min(400, holder.current.offsetWidth || 320),
          logo_alignment: "center",
        });
        setReady(true);
      })
      .catch(() => !cancelled && setReady(false));
    return () => {
      cancelled = true;
    };
  }, [clientId, dark, text]);

  if (loaded && !clientId) return null;
  return (
    <div className="relative min-h-[44px] w-full">
      {!ready && <div className="skeleton-line absolute inset-0 rounded-full" />}
      <div ref={holder} className="flex w-full justify-center" />
    </div>
  );
}

