import { useEffect, useState } from "react";
import { Moon, Phone, Sunrise, Video } from "lucide-react";
import Avatar from "../ui/Avatar";

/**
 * A short scripted conversation rendered with the real bubble styles. It
 * plays once (typing → message → reply → the "late for them" nudge) to show
 * how BlinkChat behaves, rather than decorating with stock imagery.
 */
const SCRIPT = [
  { at: 300, kind: "in", text: "Landed! The view from the hotel is unreal 🌄" },
  { at: 1500, kind: "typing" },
  { at: 2600, kind: "out", text: "So jealous. Send pics when you can!" },
  { at: 3700, kind: "in", text: "Will do. What time is it there?" },
  { at: 5000, kind: "nudge" },
];

export default function ChatPreview({ className = "", replayKey = 0 }) {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    setStep(-1);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(SCRIPT.length - 1);
      return undefined;
    }
    const timers = SCRIPT.map((s, i) => setTimeout(() => setStep(i), s.at));
    return () => timers.forEach(clearTimeout);
  }, [replayKey]);

  const visible = SCRIPT.slice(0, step + 1).filter((s, i) => s.kind !== "typing" || i === step);

  return (
    <div className={`w-full max-w-[400px] overflow-hidden rounded-[28px] border border-base-300 bg-base-100 text-base-content shadow-float ${className}`} aria-hidden="true">
      <div className="flex items-center gap-3 border-b border-base-300/60 px-4 py-3">
        <Avatar name="Liam Patel" seed="liam-demo" size={38} online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Liam Patel</p>
          <p className="text-[11px] text-base-content/55">
            online · <span className="text-base-content/45">11:42 PM their time</span>
          </p>
        </div>
        <Video className="size-[18px] text-base-content/50" />
        <Phone className="size-4 text-base-content/50" />
      </div>
      <div className="wallpaper-doodle flex h-[300px] flex-col justify-end gap-1.5 px-3 py-4">
        {visible.map((s, i) => {
          if (s.kind === "typing") {
            return (
              <div key={`t${i}`} className="anim-in-left flex">
                <span className="flex h-8 items-center gap-1 rounded-[16px] rounded-bl-[6px] bg-bubble-in px-3 shadow-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
                  <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
                </span>
              </div>
            );
          }
          if (s.kind === "nudge") return null;
          const out = s.kind === "out";
          return (
            <div key={`m${i}`} className={`flex ${out ? "justify-end anim-pop" : "anim-in-left"}`}>
              <span
                className={`max-w-[80%] rounded-[16px] px-3 py-1.5 text-[13px] leading-snug shadow-bubble ${
                  out ? "rounded-br-[6px] bg-bubble-out text-bubble-out-content" : "rounded-bl-[6px] bg-bubble-in"
                }`}
              >
                {s.text}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-base-300/60 p-3">
        {step >= SCRIPT.length - 1 && (
          <div className="anim-slide-up mb-2 flex items-center gap-2 rounded-xl bg-indigo-500/10 px-2.5 py-1.5 text-[11.5px]">
            <Moon className="size-3.5 opacity-70" />
            <span className="min-w-0 flex-1 truncate">It's 11:42 PM for Liam.</span>
            <span className="flex items-center gap-1 font-semibold text-primary">
              <Sunrise className="size-3.5" /> Send at 9:00 AM
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="h-9 flex-1 rounded-full bg-base-200/80 px-3.5 text-[13px] leading-9 text-base-content/45">Goodnight! Talk tomorrow…</div>
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-content">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 3 3 9-3 9 19-9Z" />
              <path d="M6 12h16" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
