import { useEffect, useState } from "react";
import StatusScreen from "./StatusScreen";

/**
 * Shown while the session is restored. Appears only if loading takes more
 * than a moment, so fast loads never flash a splash screen. If the server is
 * slow to answer (e.g. a free host waking up) it says so.
 */
export default function BootScreen() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 180);
    const t2 = setTimeout(() => setStage(2), 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (stage === 0) return <div className="app-shell bg-base-200" aria-busy="true" />;
  return <StatusScreen busy title="BlinkChat" body={stage === 2 ? "Taking a little longer than usual…" : "Getting things ready"} />;
}
