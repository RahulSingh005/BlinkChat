import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker, { EmojiStyle, SuggestionMode, Theme } from "emoji-picker-react";
import { Search, Smile, Sticker, X } from "lucide-react";
import Popover from "../ui/Popover";
import Sheet from "../ui/Sheet";
import Spinner from "../ui/Spinner";
import { useIsWide } from "../../hooks/useMediaQuery";
import { api, errorMessage } from "../../lib/api";
import { storage } from "../../lib/storage";
import { useFeatures } from "../../store/useConfigStore";
import { useSettingsStore } from "../../store/useSettingsStore";

const TAB_KEY = "blinkchat.pickerTab";

/** Masonry grid of GIFs or stickers from our KLIPY proxy (trending or search). */
function GifGrid({ kind, onPick, autoFocus }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [state, setState] = useState({ items: [], page: 0, hasNext: true, loading: true, error: null });
  const scrollRef = useRef(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 380);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (page, reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setState((s) => ({ ...s, loading: true, error: null, ...(reset ? { items: [] } : {}) }));
      try {
        const res = await api.get(`/media/${kind === "sticker" ? "stickers" : "gifs"}`, { params: { q: term, page, limit: 24 } });
        setState((s) => {
          const seen = new Set(reset ? [] : s.items.map((i) => i.id));
          const items = [...(reset ? [] : s.items), ...res.data.items.filter((i) => !seen.has(i.id))];
          return { items, page, hasNext: res.data.hasNext, loading: false, error: null };
        });
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: errorMessage(err, "Couldn't load GIFs") }));
      } finally {
        loadingRef.current = false;
      }
    },
    [kind, term]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    load(1, true);
  }, [load]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || state.loading || !state.hasNext || state.error) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) load(state.page + 1);
  };

  // Two balanced columns (shortest column gets the next item).
  const columns = useMemo(() => {
    const cols = [[], []];
    const heights = [0, 0];
    for (const item of state.items) {
      const ratio = item.preview.height && item.preview.width ? item.preview.height / item.preview.width : 1;
      const c = heights[0] <= heights[1] ? 0 : 1;
      cols[c].push({ item, ratio });
      heights[c] += ratio;
    }
    return cols;
  }, [state.items]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus={autoFocus}
            placeholder={kind === "sticker" ? "Search stickers" : "Search GIFs"}
            className="h-9 w-full rounded-full bg-base-200 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={kind === "sticker" ? "Search stickers" : "Search GIFs"}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="icon-btn icon-btn-sm absolute right-0.5 top-1/2 size-7 -translate-y-1/2" aria-label="Clear">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">
        {state.error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-base-content/60">
            {state.error}
            <button type="button" className="btn btn-sm rounded-lg" onClick={() => load(1, true)}>
              Try again
            </button>
          </div>
        ) : !state.loading && !state.items.length ? (
          <p className="px-4 py-10 text-center text-sm text-base-content/50">No results for “{term}”</p>
        ) : (
          <div className="flex gap-1.5">
            {columns.map((col, ci) => (
              <div key={ci} className="flex min-w-0 flex-1 flex-col gap-1.5">
                {col.map(({ item, ratio }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPick(item)}
                    title={item.title}
                    className={`anim-fade overflow-hidden rounded-lg transition hover:opacity-90 active:scale-[0.98] ${kind === "sticker" ? "bg-transparent" : "bg-base-200"}`}
                    style={{ aspectRatio: `1 / ${ratio}` }}
                  >
                    <img src={item.preview.url} alt={item.title || ""} loading="lazy" decoding="async" className={`size-full ${kind === "sticker" ? "object-contain" : "object-cover"}`} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {state.loading && (
          <div className="flex justify-center py-4">
            <Spinner className="size-5 text-base-content/40" />
          </div>
        )}
      </div>
      {/* KLIPY's terms require visible attribution. */}
      <p className="shrink-0 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-base-content/40">Powered by KLIPY</p>
    </div>
  );
}

/**
 * Emoji / GIF / sticker picker. Popover on desktop (stays open for several
 * emoji), bottom sheet on phones.
 */
export default function MediaPicker({ anchor, onClose, onEmoji, onGif, keepOpen = false }) {
  const wide = useIsWide();
  const features = useFeatures();
  const dark = useSettingsStore((s) => s.resolvedTheme === "blinkdark");
  const [tab, setTab] = useState(() => {
    const saved = storage.get(TAB_KEY, "emoji");
    return features.gifs || saved === "emoji" ? saved : "emoji";
  });

  const choose = (t) => {
    setTab(t);
    storage.set(TAB_KEY, t);
  };

  const height = wide ? 420 : 380;
  const tabs = [
    { id: "emoji", label: "Emoji", icon: Smile },
    features.gifs && { id: "gif", label: "GIF" },
    features.gifs && { id: "sticker", label: "Stickers", icon: Sticker },
  ].filter(Boolean);

  const body = (
    <div className="flex flex-col" style={{ height }}>
      <div className="min-h-0 flex-1">
        {tab === "emoji" ? (
          <EmojiPicker
            onEmojiClick={(data) => {
              onEmoji(data.emoji);
              if (!keepOpen) onClose();
            }}
            emojiStyle={EmojiStyle.NATIVE}
            theme={dark ? Theme.DARK : Theme.LIGHT}
            lazyLoadEmojis
            autoFocusSearch={wide}
            suggestedEmojisMode={SuggestionMode.RECENT}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled={!wide}
            searchPlaceholder="Search emoji"
            width="100%"
            height={tabs.length > 1 ? height - 44 : height}
          />
        ) : (
          <GifGrid
            key={tab}
            kind={tab}
            autoFocus={wide}
            onPick={(item) => {
              onGif(item);
              onClose();
            }}
          />
        )}
      </div>
      {tabs.length > 1 && (
        <div className="flex h-11 shrink-0 items-center justify-center gap-1 border-t border-base-300/70 px-2" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => choose(t.id)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold transition-colors ${
                tab === t.id ? "bg-primary/15 text-primary" : "text-base-content/60 hover:bg-base-content/[0.06]"
              }`}
            >
              {t.icon && <t.icon className="size-4" />}
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (!wide) {
    return (
      <Sheet open onClose={onClose} size="sm" showClose={false} bare>
        <div className="px-1 pb-1">{body}</div>
      </Sheet>
    );
  }
  return (
    <Popover anchor={anchor} onClose={onClose} width={360} autoFocus={false} className="overflow-hidden">
      {body}
    </Popover>
  );
}
