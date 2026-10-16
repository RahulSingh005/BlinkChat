import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import Spinner from "../ui/Spinner";
import { useIsWide } from "../../hooks/useMediaQuery";
import { api } from "../../lib/api";
import { firstName, formatListTime } from "../../lib/format";
import { previewText } from "../../lib/preview";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatStore } from "../../store/useChatStore";
import { useUIStore } from "../../store/useUIStore";

function Highlight({ text, query }) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text;
  const start = Math.max(0, i - 30);
  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, i)}
      <mark className="rounded bg-warning/40 px-0.5 text-inherit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

/** In-chat message search with highlighted results; tap to jump. */
export default function ChatSearch({ conv }) {
  const me = useAuthStore((s) => s.authUser);
  const wide = useIsWide();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const close = () => {
    useUIStore.setState({ searchOpen: false, searchQuery: "" });
  };

  useEffect(() => {
    inputRef.current?.focus();
    return () => useUIStore.setState({ searchQuery: "" });
  }, []);

  useEffect(() => {
    const term = q.trim();
    useUIStore.setState({ searchQuery: term.length >= 2 ? term : "" });
    if (term.length < 2) {
      setResults(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/conversations/${conv._id}/messages/search`, { params: { q: term }, signal: controller.signal });
        setResults(res.data.messages);
      } catch {
        // aborted / failed
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, conv._id]);

  const nameOf = (id) => (id === me._id ? "You" : firstName(conv.members.find((m) => m.user._id === id)?.user.fullName || "Someone"));

  return (
    <div className="anim-slide-down absolute inset-x-0 top-0 z-30 flex max-h-[70%] flex-col border-b border-base-300/70 bg-base-100 shadow-float md:inset-x-auto md:right-4 md:top-[4.5rem] md:w-[380px] md:rounded-2xl md:border">
      <div className="safe-top flex items-center gap-1 p-2">
        {!wide && (
          <button type="button" className="icon-btn" onClick={close} aria-label="Close search">
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && close()}
            placeholder="Search this chat"
            className="h-10 w-full rounded-xl bg-base-200/80 pl-9 pr-3 text-[0.9rem] outline-none focus:ring-2 focus:ring-primary/25"
            aria-label="Search messages in this chat"
          />
        </div>
        {loading ? <Spinner className="mx-2 size-4 text-base-content/40" /> : null}
        {wide && (
          <button type="button" className="icon-btn icon-btn-sm" onClick={close} aria-label="Close search">
            <X className="size-4" />
          </button>
        )}
      </div>
      {results && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-base-content/50">No messages found</p>
          ) : (
            <>
              <p className="px-3 pb-1 text-xs text-base-content/45">
                {results.length}
                {results.length === 50 ? "+" : ""} result{results.length === 1 ? "" : "s"}
              </p>
              {results.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => {
                    useChatStore.getState().jumpToMessage(conv._id, m._id);
                    if (!wide) useUIStore.setState({ searchOpen: false });
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-base-content/[0.05]"
                >
                  <span className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold">{nameOf(m.sender)}</span>
                    <span className="text-base-content/45">{formatListTime(m.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[0.85rem] text-base-content/75">
                    <Highlight text={m.text || previewText(m, { conv, meId: me._id })} query={q.trim()} />
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
