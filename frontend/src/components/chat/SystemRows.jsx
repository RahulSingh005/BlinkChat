import { memo } from "react";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from "lucide-react";
import { formatTime } from "../../lib/format";
import { callText, systemText } from "../../lib/preview";

export const SystemRow = memo(function SystemRow({ message, conv, meId, cascade }) {
  return (
    <div data-mid={message._id} className={`flex justify-center px-4 py-1.5 ${cascade !== undefined ? "anim-cascade" : message.fresh ? "anim-fade" : ""}`} style={{ "--i": cascade }}>
      <span className="max-w-[85%] rounded-full bg-base-100/90 px-3 py-1 text-center text-xs text-base-content/60 shadow-sm backdrop-blur">
        {systemText(message, conv, meId)}
      </span>
    </div>
  );
});

export const CallRow = memo(function CallRow({ message, meId, onCallBack, cascade }) {
  const outgoing = message.sender === meId;
  const status = message.call?.status;
  const missed = !outgoing && status !== "completed";
  const Icon = message.call?.kind === "video" ? Video : missed ? PhoneMissed : outgoing ? PhoneOutgoing : status === "completed" ? PhoneIncoming : Phone;
  return (
    <div data-mid={message._id} className={`flex justify-center px-4 py-1.5 ${cascade !== undefined ? "anim-cascade" : message.fresh ? "anim-fade" : ""}`} style={{ "--i": cascade }}>
      <button
        type="button"
        onClick={() => onCallBack(message.call?.kind || "voice")}
        className="flex items-center gap-2.5 rounded-2xl bg-base-100/95 px-3.5 py-2 text-left shadow-sm backdrop-blur transition hover:bg-base-100"
        title="Call back"
      >
        <span className={`flex size-8 items-center justify-center rounded-full ${missed ? "bg-error/10 text-error" : "bg-success/15 text-success"}`}>
          <Icon className="size-4" />
        </span>
        <span>
          <span className={`block text-sm font-medium ${missed ? "text-error" : ""}`}>{callText(message, meId)}</span>
          <span className="block text-[11px] text-base-content/45">{formatTime(message.createdAt)} · Tap to call back</span>
        </span>
      </button>
    </div>
  );
});

export function DateDivider({ label }) {
  return (
    <div className="pointer-events-none flex justify-center py-2" data-day={label}>
      <span className="rounded-full bg-base-100/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-base-content/55 shadow-sm backdrop-blur">
        {label}
      </span>
    </div>
  );
}

export function UnreadDivider({ count }) {
  return (
    <div data-unread-divider className="my-2 flex items-center gap-3 px-4">
      <span className="h-px flex-1 bg-primary/30" />
      <span className="text-xs font-semibold text-primary">
        {count} unread message{count === 1 ? "" : "s"}
      </span>
      <span className="h-px flex-1 bg-primary/30" />
    </div>
  );
}

export function TypingBubble({ names, isGroup }) {
  return (
    <div className="anim-in-left mt-2 flex items-end gap-2 px-2 md:px-4">
      {isGroup && <div className="w-8 shrink-0" />}
      <div className="flex items-center gap-2">
        <span className="flex h-9 items-center gap-1 rounded-[18px] rounded-bl-[6px] border border-bubble-in-border/70 bg-bubble-in px-3.5 shadow-bubble">
          <span className="typing-dot" />
          <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
          <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
        </span>
        {isGroup && names && <span className="text-xs text-base-content/50">{names}</span>}
      </div>
    </div>
  );
}
