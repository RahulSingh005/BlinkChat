import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let scriptLoadingPromise = null;

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
};

/**
 * Renders Google's own "Continue with Google" button and wires the
 * resulting ID token to our backend's /auth/google endpoint.
 * If VITE_GOOGLE_CLIENT_ID isn't set, this renders a disabled button
 * explaining that Google sign-in needs to be configured, instead of
 * silently failing.
 */
const GoogleAuthButton = ({ label = "Continue with Google" }) => {
  const buttonRef = useRef(null);
  const [ready, setReady] = useState(false);
  const googleAuth = useAuthStore((s) => s.googleAuth);

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            if (!credential) {
              toast.error("Google sign-in didn't return a valid credential");
              return;
            }
            await googleAuth(credential);
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          width: buttonRef.current.offsetWidth || 320,
          text: label === "Continue with Google" ? "continue_with" : "signin_with",
          shape: "pill",
        });

        setReady(true);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load Google sign-in");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Google sign-in isn't configured. Add VITE_GOOGLE_CLIENT_ID to your frontend .env file."
        className="btn btn-outline w-full rounded-xl gap-2 opacity-60 cursor-not-allowed"
      >
        <GoogleIcon />
        {label}
      </button>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <div ref={buttonRef} className="w-full flex justify-center" />
      {!ready && (
        <button
          type="button"
          disabled
          className="btn btn-outline w-full rounded-xl gap-2 opacity-60"
        >
          <GoogleIcon />
          {label}
        </button>
      )}
    </div>
  );
};

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.3 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.9 39.7 16.4 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.6 5.6C41.6 35.9 44 30.4 44 24c0-1.3-.1-2.3-.4-3.5z"
    />
  </svg>
);

export default GoogleAuthButton;
