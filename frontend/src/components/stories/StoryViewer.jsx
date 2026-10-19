import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Eye, Pause, Play, SendHorizontal, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { STORY_FONTS, storyTextSize } from "./storyStyle";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { errorMessage, mediaUrl } from "../../lib/api";
import { formatAgoShort, formatTime } from "../../lib/format";
import { useAuthStore } from "../../store/useAuthStore";
import { useStoryStore } from "../../store/useStoryStore";

const REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🔥"];
const HOLD_MS = 220;

const durationOf = (story) => {
  if (story.kind === "text") return Math.min(10000, 4500 + (story.text?.length || 0) * 35);
  return 6000;
};

function ViewersPanel({ story, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    useStoryStore
      .getState()
      .viewers(story._id)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ viewers: [], total: 0 }));
    return () => {
      cancelled = true;
    };
  }, [story._id]);

  return (
    <div className="anim-sheet absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-hidden rounded-t-3xl bg-base-100 text-base-content" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h3 className="font-semibold">{data ? `Viewed by ${data.total}` : "Viewers"}</h3>
        <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Close viewers">
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[calc(60vh-56px)] overflow-y-auto px-3 pb-6">
        {!data ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-5 text-base-content/40" />
          </div>
        ) : data.receiptsOff ? (
          <p className="px-2 py-4 text-sm text-base-content/55">Turn on read receipts in Settings → Privacy to see who viewed your status.</p>
        ) : data.viewers.length === 0 ? (
          <p className="px-2 py-4 text-sm text-base-content/55">No views yet.</p>
        ) : (
          <ul>
            {data.viewers.map((v) => (
              <li key={v.user._id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar src={v.user.profilePic} name={v.user.fullName} seed={v.user._id} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{v.user.fullName}</span>
                  <span className="block text-xs text-base-content/50">{formatTime(v.at)}</span>
                </span>
                {v.reaction && <span className="text-xl">{v.reaction}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Full-screen status viewer: progress bars, tap/hold/swipe, replies and reactions. */
export default function StoryViewer() {
  const me = useAuthStore((s) => s.authUser);
  const viewer = useStoryStore((s) => s.viewer);
  const mine = useStoryStore((s) => s.mine);
  const others = useStoryStore((s) => s.others);

  const groups = useMemo(
    () => (viewer?.userIds || []).map((id) => (id === me._id ? mine : others.find((g) => g.user._id === id))).filter(Boolean),
    [viewer?.userIds, me._id, mine, others]
  );
  const firstUnseen = useCallback(
    (g) => {
      if (!g || g.user._id === me._id) return 0;
      const i = g.stories.findIndex((s) => !s.viewed);
      return i === -1 ? 0 : i;
    },
    [me._id]
  );

  const [pos, setPos] = useState(() => ({ g: viewer?.index || 0, s: firstUnseen(groups[viewer?.index || 0]) }));
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [sending, setSending] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [floating, setFloating] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const barRef = useRef(null);
  const videoRef = useRef(null);
  const elapsed = useRef(0);
  const hold = useRef(null);

  const group = groups[pos.g];
  const story = group?.stories[Math.min(pos.s, (group?.stories.length || 1) - 1)];
  const isMine = group?.user._id === me._id;
  const storyId = story?._id;
  const storyKind = story?.kind;
  const storyText = story?.text;
  const halted = paused || replying || showViewers || sending || !loaded;

  const close = useCallback(() => useStoryStore.getState().closeViewer(), []);

  const go = useCallback(
    (dir) => {
      setPos((p) => {
        const g = groups[p.g];
        if (!g) return p;
        if (dir > 0) {
          if (p.s + 1 < g.stories.length) return { g: p.g, s: p.s + 1 };
          if (p.g + 1 < groups.length) return { g: p.g + 1, s: firstUnseen(groups[p.g + 1]) };
          setTimeout(close, 0);
          return p;
        }
        if (p.s > 0) return { g: p.g, s: p.s - 1 };
        if (p.g > 0) return { g: p.g - 1, s: 0 };
        return { ...p, s: 0 };
      });
    },
    [groups, close, firstUnseen]
  );

  const jumpGroup = (dir) => {
    const g = pos.g + dir;
    if (g < 0) return;
    if (g >= groups.length) return close();
    setPos({ g, s: firstUnseen(groups[g]) });
  };

  // Nothing left to show (deleted / expired): close.
  useEffect(() => {
    if (viewer && !group) close();
  }, [viewer, group, close]);

  // Reset per story + mark as viewed.
  useEffect(() => {
    if (!storyId) return;
    elapsed.current = 0;
    setLoaded(storyKind === "text");
    if (barRef.current) barRef.current.style.transform = "scaleX(0)";
    if (!isMine) useStoryStore.getState().markViewed(storyId);
  }, [storyId, storyKind, isMine]);

  // Progress loop for text/photo stories (videos follow their own time).
  useEffect(() => {
    if (!storyId || storyKind === "video") return undefined;
    const total = durationOf({ kind: storyKind, text: storyText });
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last;
      last = now;
      if (!halted) elapsed.current += dt;
      const p = Math.min(1, elapsed.current / total);
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      if (p >= 1) go(1);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [storyId, storyKind, storyText, halted, go]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (halted && loaded) v.pause();
    else if (!halted) v.play().catch(() => {});
  }, [halted, loaded, storyId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, close]);

  if (!group || !story) return null;

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    hold.current = { x: e.clientX, y: e.clientY, t: performance.now(), timer: setTimeout(() => setPaused(true), HOLD_MS) };
  };
  const onPointerUp = (e) => {
    const h = hold.current;
    hold.current = null;
    if (!h) return;
    clearTimeout(h.timer);
    const dy = e.clientY - h.y;
    const dx = e.clientX - h.x;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return close();
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) return jumpGroup(dx < 0 ? 1 : -1);
    if (performance.now() - h.t >= HOLD_MS) {
      setPaused(false);
      return undefined;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width * 0.3 ? -1 : 1);
    return undefined;
  };

  const react = async (emoji) => {
    setFloating({ emoji, key: Date.now() });
    try {
      await useStoryStore.getState().react(story._id, emoji);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const sendReply = async (e) => {
    e?.preventDefault();
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try {
      await useStoryStore.getState().reply(story._id, text);
      setReply("");
      setReplying(false);
      document.activeElement?.blur?.();
      toast.success("Reply sent");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send your reply"));
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    setPaused(true);
    try {
      await useStoryStore.getState().remove(story._id);
      toast.success("Status deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPaused(false);
    }
  };

  const font = STORY_FONTS[story.font] || STORY_FONTS.sans;

  return createPortal(
    <div className="anim-fade fixed inset-0 z-[96] flex items-center justify-center bg-black text-white" role="dialog" aria-modal="true" aria-label={`Status from ${group.user.fullName}`}>
      {/* Desktop: neighbours */}
      <button type="button" onClick={() => jumpGroup(-1)} disabled={pos.g === 0} className="absolute left-4 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-0 md:flex" aria-label="Previous person">
        <ChevronLeft className="size-6" />
      </button>
      <button type="button" onClick={() => jumpGroup(1)} className="absolute right-4 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 md:flex" aria-label="Next person">
        <ChevronRight className="size-6" />
      </button>

      <div className="relative flex h-full w-full flex-col overflow-hidden md:h-[min(92vh,860px)] md:w-auto md:max-w-[480px] md:rounded-3xl" style={{ aspectRatio: "9 / 16" }}>
        {/* Content */}
        <div
          key={story._id}
          className="anim-fade absolute inset-0 flex select-none items-center justify-center"
          style={story.kind === "text" ? { background: story.background } : undefined}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => hold.current && clearTimeout(hold.current.timer)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {story.kind === "text" ? (
            <p className={`max-h-full overflow-hidden whitespace-pre-wrap break-words px-8 text-center ${font.className} ${storyTextSize(story.text)}`}>{story.text}</p>
          ) : (
            <>
              {story.media.kind === "image" && <img src={mediaUrl(story.media.url)} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />}
              {story.media.kind === "image" ? (
                <img src={mediaUrl(story.media.url)} alt={story.caption || "Status photo"} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} className="relative max-h-full max-w-full object-contain" draggable={false} />
              ) : (
                <video
                  ref={videoRef}
                  src={mediaUrl(story.media.url)}
                  autoPlay
                  playsInline
                  muted={muted}
                  onLoadedData={() => setLoaded(true)}
                  onError={() => setLoaded(true)}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (barRef.current && v.duration) barRef.current.style.transform = `scaleX(${Math.min(1, v.currentTime / v.duration)})`;
                  }}
                  onEnded={() => go(1)}
                  className="relative max-h-full max-w-full object-contain"
                />
              )}
              {!loaded && <Spinner className="absolute size-8 text-white/70" />}
            </>
          )}
        </div>

        {/* Top: progress + author */}
        <div className="safe-top pointer-events-none relative z-10 bg-gradient-to-b from-black/55 to-transparent px-3 pb-6 pt-2">
          <div className="flex gap-1">
            {group.stories.map((s, i) => (
              <span key={s._id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span
                  ref={i === pos.s ? barRef : undefined}
                  className="block h-full origin-left rounded-full bg-white"
                  style={{ transform: i < pos.s ? "scaleX(1)" : i > pos.s ? "scaleX(0)" : undefined }}
                />
              </span>
            ))}
          </div>
          <div className="pointer-events-auto mt-3 flex items-center gap-2.5">
            <Avatar src={group.user.profilePic} name={group.user.fullName} seed={group.user._id} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{isMine ? "My status" : group.user.fullName}</p>
              <p className="text-xs text-white/70">{formatAgoShort(story.createdAt)} ago</p>
            </div>
            {story.media?.kind === "video" && (
              <button type="button" onClick={() => setMuted((m) => !m)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
            )}
            <button type="button" onClick={() => setPaused((p) => !p)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label={paused ? "Play" : "Pause"}>
              {paused ? <Play className="size-5 fill-current" /> : <Pause className="size-5 fill-current" />}
            </button>
            {isMine && (
              <button type="button" onClick={remove} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="Delete status">
                <Trash2 className="size-5" />
              </button>
            )}
            <button type="button" onClick={close} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="Close">
              <X className="size-6" />
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {/* Bottom: caption + reply / viewers */}
        <div className="safe-bottom relative z-10 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-10">
          {story.caption && <p className="mb-3 whitespace-pre-wrap px-1 text-center text-[0.95rem] drop-shadow">{story.caption}</p>}
          {isMine ? (
            <button
              type="button"
              onClick={() => setShowViewers(true)}
              className="mx-auto flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/25"
            >
              <Eye className="size-4" /> {story.viewCount || 0} view{story.viewCount === 1 ? "" : "s"}
            </button>
          ) : (
            <>
              {replying && (
                <div className="anim-slide-up mb-2 flex justify-center gap-1.5">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => react(emoji)}
                      className={`flex size-11 items-center justify-center rounded-full text-2xl transition hover:scale-110 active:scale-95 ${story.myReaction === emoji ? "bg-white/30" : "bg-white/10"}`}
                      aria-label={`React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={sendReply} className="flex items-center gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onFocus={() => setReplying(true)}
                  onBlur={() => setTimeout(() => setReplying(false), 120)}
                  maxLength={1000}
                  placeholder={`Reply to ${group.user.fullName.split(" ")[0]}…`}
                  className="h-11 min-w-0 flex-1 rounded-full border border-white/25 bg-black/30 px-4 text-[0.95rem] text-white outline-none backdrop-blur placeholder:text-white/60 focus:border-white/50"
                />
                {reply.trim() ? (
                  <button type="submit" disabled={sending} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-content" aria-label="Send reply">
                    {sending ? <Spinner className="size-4" /> : <SendHorizontal className="size-5" />}
                  </button>
                ) : (
                  <button type="button" onClick={() => react("❤️")} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl transition active:scale-90" aria-label="Like">
                    {story.myReaction || "🤍"}
                  </button>
                )}
              </form>
            </>
          )}
        </div>

        {floating && (
          <span className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center">
            <span key={floating.key} className="anim-float-up text-5xl" onAnimationEnd={() => setFloating(null)}>
              {floating.emoji}
            </span>
          </span>
        )}
        {showViewers && isMine && <ViewersPanel story={story} onClose={() => setShowViewers(false)} />}
      </div>
    </div>,
    document.body
  );
}
