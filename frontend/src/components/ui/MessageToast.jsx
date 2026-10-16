import toast from "react-hot-toast";
import { AlarmClock, X } from "lucide-react";
import Avatar from "./Avatar";

/** In-app notification for messages and reminders (tap to open). */
export default function MessageToast({ t, title, body, avatar, icon, urgent = false, onOpen }) {
  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-[min(92vw,380px)] items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-3 pr-2 shadow-float transition-all duration-300 ${
        t.visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => {
          toast.dismiss(t.id);
          onOpen?.();
        }}
      >
        {icon === "reminder" ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlarmClock className="size-5" />
          </span>
        ) : (
          <Avatar size={40} {...avatar} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{title}</span>
            {urgent && <span className="rounded bg-error/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-error">Urgent</span>}
          </span>
          <span className="line-clamp-2 text-[0.8125rem] text-base-content/65">{body}</span>
        </span>
      </button>
      <button type="button" className="icon-btn icon-btn-sm" aria-label="Dismiss" onClick={() => toast.dismiss(t.id)}>
        <X className="size-4" />
      </button>
    </div>
  );
}
