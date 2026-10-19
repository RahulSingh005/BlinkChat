import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Delete, Lock } from "lucide-react";
import Avatar from "../ui/Avatar";
import { vibrate } from "../../lib/platform";
import { useAuthStore } from "../../store/useAuthStore";
import { useLockStore } from "../../store/useLockStore";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
const MAX_TRIES = 5;

/** Full-screen PIN prompt shown while the app is locked. */
export default function AppLock() {
  const locked = useLockStore((s) => s.locked);
  const me = useAuthStore((s) => s.authUser);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const tries = useRef(0);
  const [cooldown, setCooldown] = useState(0);

  // Lock again after the app has been in the background for a while.
  useEffect(() => {
    const onVis = () => (document.visibilityState === "hidden" ? useLockStore.getState().onHidden() : useLockStore.getState().onVisible());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!cooldown) return undefined;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = useCallback(
    async (value) => {
      setChecking(true);
      const ok = await useLockStore.getState().verify(value);
      setChecking(false);
      if (ok) {
        tries.current = 0;
        setPin("");
        setError("");
        useLockStore.getState().unlock();
        return;
      }
      tries.current += 1;
      vibrate([20, 40, 20]);
      setShake(true);
      setTimeout(() => setShake(false), 420);
      setPin("");
      if (tries.current >= MAX_TRIES) {
        tries.current = 0;
        setCooldown(30);
        setError("Too many attempts. Try again in 30 seconds.");
      } else {
        setError("Wrong PIN");
      }
    },
    []
  );

  const press = useCallback(
    (key) => {
      if (checking || cooldown) return;
      if (key === "del") {
        setPin(pin.slice(0, -1));
        return;
      }
      if (!/^\d$/.test(key)) return;
      setError("");
      const next = (pin + key).slice(0, 6);
      setPin(next);
      // PINs are 4-6 digits: 6 submits automatically, shorter ones use Enter.
      if (next.length === 6) submit(next);
    },
    [checking, cooldown, pin, submit]
  );

  useEffect(() => {
    if (!locked) return undefined;
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter" && pin.length >= 4) submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, press, pin, submit]);

  if (!locked) return null;

  return createPortal(
    <div className="anim-fade fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-base-200 px-6" role="dialog" aria-modal="true" aria-label="BlinkChat is locked">
      <div className="flex w-full max-w-xs flex-col items-center">
        <div className="relative">
          <Avatar src={me?.profilePic} name={me?.fullName} seed={me?._id} size={72} />
          <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-base-100 text-base-content/70 shadow-soft">
            <Lock className="size-3.5" />
          </span>
        </div>
        <h1 className="mt-4 text-lg font-semibold">Enter your PIN</h1>
        <p className={`mt-1 h-5 text-sm ${error ? "text-error" : "text-base-content/55"}`}>{error || (cooldown ? `Wait ${cooldown}s` : "BlinkChat is locked")}</p>

        <div className={`my-6 flex gap-3 ${shake ? "anim-shake" : ""}`} aria-live="polite" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <span key={i} className={`size-3.5 rounded-full transition-all duration-150 ${i < pin.length ? "scale-110 bg-primary" : "bg-base-content/15"}`} />
          ))}
        </div>

        <div className="grid w-full grid-cols-3 gap-3">
          {KEYS.map((k, i) =>
            k === "" ? (
              <span key={i} />
            ) : (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                disabled={Boolean(cooldown)}
                className="flex h-16 items-center justify-center rounded-2xl bg-base-100 text-2xl font-medium shadow-sm transition active:scale-95 active:bg-base-300 disabled:opacity-40"
                aria-label={k === "del" ? "Delete digit" : k}
              >
                {k === "del" ? <Delete className="size-6" /> : k}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary mt-5 h-11 min-h-0 w-full rounded-xl"
          disabled={pin.length < 4 || checking || Boolean(cooldown)}
          onClick={() => submit(pin)}
        >
          Unlock
        </button>
        <button
          type="button"
          className="mt-4 text-sm text-base-content/55 underline-offset-2 hover:underline"
          onClick={() => {
            useLockStore.getState().disable();
            useAuthStore.getState().logout();
          }}
        >
          Forgot PIN? Sign out
        </button>
      </div>
    </div>,
    document.body
  );
}
