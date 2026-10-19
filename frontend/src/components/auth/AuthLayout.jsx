import { Link } from "react-router-dom";
import ChatPreview from "../marketing/ChatPreview";
import Logo from "../ui/Logo";

/** Shared frame for sign in / sign up / reset: form left, product right. */
export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-dvh bg-base-100 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="safe-top flex min-w-0 flex-col px-5 pb-6 pt-6 sm:px-10">
        <Link to="/" className="w-fit" aria-label="BlinkChat home">
          <Logo size={34} />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="anim-slide-up w-full max-w-sm">{children}</div>
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
