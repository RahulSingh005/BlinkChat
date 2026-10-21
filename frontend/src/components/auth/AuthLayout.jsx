import { Link } from "react-router-dom";
import { CloudOff } from "lucide-react";
import { useConfigStore } from "../../store/useConfigStore";
import ChatPreview from "../marketing/ChatPreview";
import Logo from "../ui/Logo";

/** Shared frame for sign in / sign up / reset: form left, product right. */
function ServerNotice() {
  const unreachable = useConfigStore((s) => s.unreachable);
  if (!unreachable) return null;
  return (
    <div role="alert" className="anim-slide-down mb-6 flex gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-sm">
      <CloudOff className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="min-w-0">
        <p className="font-semibold">Can't reach the BlinkChat server</p>
        <p className="mt-0.5 text-[0.8125rem] text-base-content/65">
          It may be waking up, try again in a moment. If you run this site, add <span className="font-mono">{window.location.origin}</span> to CLIENT_URL on the
          backend.
        </p>
        <button type="button" className="mt-2 text-[0.8125rem] font-semibold text-primary hover:underline" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-dvh bg-base-100 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="safe-top flex min-h-dvh min-w-0 flex-col px-5 pb-6 pt-5 sm:px-10 sm:pt-6 lg:min-h-0">
        <Link to="/" className="w-fit" aria-label="BlinkChat home">
          <Logo size={32} />
        </Link>
        <div className="flex flex-1 items-start justify-center pb-8 pt-10 sm:items-center sm:py-10">
          <div className="anim-slide-up w-full max-w-sm">
            <ServerNotice />
            {children}
          </div>
        </div>
        <footer className="flex justify-center gap-4 text-xs text-base-content/45">
          <Link to="/privacy" className="hover:text-base-content">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-base-content">
            Terms
          </Link>
          <span>© {new Date().getFullYear()} BlinkChat</span>
        </footer>
      </div>
      <aside className="relative hidden items-center justify-center overflow-hidden border-l border-base-300/60 bg-base-200 p-12 lg:flex">
        <div className="bg-grid absolute inset-0" />
        <div className="relative flex max-w-md flex-col items-center gap-10">
          <ChatPreview />
          <div className="text-center">
            <p className="text-balance text-2xl font-semibold tracking-tight">
              Messages that arrive at <span className="text-primary">the right moment.</span>
            </p>
            <p className="mt-2 text-sm text-base-content/60">See their local time, schedule for their morning, and catch up in seconds.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
