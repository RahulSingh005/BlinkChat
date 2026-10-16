import { useEffect, useState } from "react";
import { LogoMark } from "../ui/Logo";

/**
 * Shown while the session is restored. Appears only if loading takes more
 * than a moment, so fast loads never flash a splash screen.
 */
export default function BootScreen() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 180);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="app-shell flex flex-col items-center justify-center gap-5 bg-base-200" aria-busy="true" aria-label="Loading BlinkChat">
      {show && (
        <div className="anim-scale-in flex flex-col items-center gap-4">
          <LogoMark size={56} animated className="drop-shadow-sm" />
          <span className="text-sm font-medium text-base-content/45">Loading your chats</span>
        </div>
      )}
    </div>
  );
}
