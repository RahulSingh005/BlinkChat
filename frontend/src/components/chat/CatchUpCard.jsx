import { useState } from "react";
import toast from "react-hot-toast";
import { Sparkles, X } from "lucide-react";
import Spinner from "../ui/Spinner";
import { api, errorMessage } from "../../lib/api";

/**
 * "Catch me up": an AI summary of what arrived while you were away. Only
 * runs when tapped — nothing is sent to the AI provider automatically.
 */
export default function CatchUpCard({ conv, anchor }) {
  const [state, setState] = useState("idle"); // idle | loading | done | hidden
  const [lines, setLines] = useState([]);

  const run = async () => {
    setState("loading");
    try {
      const res = await api.post("/ai/summarize", { conversationId: conv._id, mode: "unread", since: anchor.since || undefined });
      setLines(
        res.data.summary
          .split("\n")
          .map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim())
          .filter(Boolean)
      );
      setState("done");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't summarize right now"));
      setState("idle");
    }
  };

  if (state === "hidden") return null;

  return (
    <div className="anim-slide-up mx-auto my-3 w-[min(92%,32rem)]">
      <div className="rounded-2xl border border-base-300/70 bg-base-100/95 p-3.5 shadow-soft backdrop-blur">
        {state === "done" ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <span className="text-sm font-semibold">Catch-up</span>
              <span className="text-xs text-base-content/45">{anchor.count} new messages</span>
              <button type="button" className="icon-btn icon-btn-sm ml-auto size-7" onClick={() => setState("hidden")} aria-label="Dismiss summary">
                <X className="size-4" />
              </button>
            </div>
            <ul className="space-y-1.5">
              {lines.map((line, i) => (
                <li key={i} className="anim-cascade flex gap-2 text-[0.9rem] leading-snug" style={{ "--i": i * 2 }}>
                  <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-accent/70" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11px] text-base-content/40">AI-generated summary · may contain mistakes</p>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Sparkles className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{anchor.count} new messages</p>
              <p className="text-xs text-base-content/55">Get the gist before you scroll.</p>
            </div>
            <button type="button" className="btn btn-sm h-9 min-h-0 rounded-xl" onClick={run} disabled={state === "loading"}>
              {state === "loading" ? <Spinner className="size-4" /> : "Catch me up"}
            </button>
            <button type="button" className="icon-btn icon-btn-sm size-7" onClick={() => setState("hidden")} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
