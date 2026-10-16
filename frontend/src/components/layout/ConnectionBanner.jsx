import { useEffect, useState } from "react";
import { CloudOff, LoaderCircle } from "lucide-react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatStore } from "../../store/useChatStore";

/**
 * Slim status bar for offline / reconnecting states. Waits a moment before
 * appearing so brief network blips don't flash it.
 */
export default function ConnectionBanner() {
  const online = useOnlineStatus();
  const connection = useAuthStore((s) => s.connection);
  const queued = useChatStore((s) => s.outbox.length);
  const problem = !online ? "offline" : connection === "reconnecting" ? "reconnecting" : null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!problem) {
      setVisible(false);
      return undefined;
    }
    const t = setTimeout(() => setVisible(true), problem === "offline" ? 300 : 2500);
    return () => clearTimeout(t);
  }, [problem]);

  if (!visible || !problem) return null;

  return (
    <div className="safe-top anim-slide-down shrink-0 bg-neutral text-neutral-content" role="status">
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium">
        {problem === "offline" ? <CloudOff className="size-3.5" /> : <LoaderCircle className="size-3.5 animate-spin" />}
        {problem === "offline"
          ? `You're offline${queued ? ` · ${queued} message${queued === 1 ? "" : "s"} will send when you're back` : ""}`
          : "Reconnecting…"}
      </div>
    </div>
  );
}
