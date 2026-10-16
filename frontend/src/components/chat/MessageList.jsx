import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDown } from "lucide-react";
import CatchUpCard from "./CatchUpCard";
import MessageBubble from "./MessageBubble";
import MessageMenu from "./MessageMenu";
import { CallRow, DateDivider, SystemRow, TypingBubble, UnreadDivider } from "./SystemRows";
import Spinner from "../ui/Spinner";
import { MessagesSkeleton } from "../ui/Skeletons";
import { api, errorMessage } from "../../lib/api";
import { firstName, formatDayLabel, isSameDay } from "../../lib/format";
import { useAuthStore } from "../../store/useAuthStore";
import { useCallStore } from "../../store/useCallStore";
import { peerOf, receiptFor, useChatStore } from "../../store/useChatStore";
import { useAiEnabled, useConfigStore } from "../../store/useConfigStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUIStore } from "../../store/useUIStore";

const GROUP_GAP_MS = 5 * 60 * 1000;
const CASCADE_ROWS = 12;

/** Flattens messages into rows: date dividers, unread divider, bubbles. */
function buildRows(items, { meId, anchor }) {
  const rows = [];
  let unreadPlaced = false;
  for (let i = 0; i < items.length; i += 1) {
    const m = items[i];
    const prev = items[i - 1];
    const next = items[i + 1];
    if (!prev || !isSameDay(prev.createdAt, m.createdAt)) {
      rows.push({ kind: "date", key: `d-${m.createdAt}`, label: formatDayLabel(m.createdAt) });
    }
    if (anchor && !unreadPlaced && m.sender !== meId && m.type !== "system" && new Date(m.createdAt) > new Date(anchor.since || 0)) {
      rows.push({ kind: "unread", key: "unread", count: anchor.count });
      unreadPlaced = true;
    }
    if (m.type === "system" || m.type === "call") {
      rows.push({ kind: m.type, key: m.clientId || m._id, message: m });
      continue;
    }
    const joins = (a, b) =>
      a && b && a.type === "user" && b.type === "user" && a.sender === b.sender && isSameDay(a.createdAt, b.createdAt) && Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < GROUP_GAP_MS;
    rows.push({
      kind: "message",
      key: m.clientId || m._id,
      message: m,
      mine: m.sender === meId,
      groupStart: !joins(prev, m),
      groupEnd: !joins(m, next),
    });
  }
  return rows;
}

export default function MessageList({ conv, wallpaper }) {
  const me = useAuthStore((s) => s.authUser);
  const thread = useChatStore((s) => s.threads[conv._id]);
  const anchor = useChatStore((s) => s.anchors[conv._id]);
  const jump = useChatStore((s) => s.jump);
  const translations = useChatStore((s) => s.translations);
  const typing = useChatStore((s) => s.typing[conv._id]);
  const autoTranslate = useSettingsStore((s) => Boolean(s.autoTranslate[conv._id]));
  const ai = useAiEnabled();
  const transcription = useConfigStore((s) => Boolean(s.config?.features?.ai?.transcription));
  const searchQuery = useUIStore((s) => (s.searchOpen ? s.searchQuery || "" : ""));

  const scrollRef = useRef(null);
  const nearBottom = useRef(true);
  const prepend = useRef(null);
  const initialDone = useRef(false);
  const lastKey = useRef(null);
  const firstKey = useRef(null);
  const pendingJump = useRef(null);
  const dateTimer = useRef(null);
  const [showJump, setShowJump] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [floatingDate, setFloatingDate] = useState(null);
  const [cascade, setCascade] = useState(true);
  const [menu, setMenu] = useState(null);

  const items = useMemo(() => thread?.items || [], [thread?.items]);
  const isGroup = conv.type === "group";
  const rows = useMemo(() => buildRows(items, { meId: me._id, anchor }), [items, me._id, anchor]);

  const membersById = useMemo(() => new Map(conv.members.map((m) => [m.user._id, m.user])), [conv.members]);
  const nameOf = useCallback((id) => (id === me._id ? "You" : membersById.get(id)?.fullName || "Deleted account"), [membersById, me._id]);

  // Stop the entrance cascade shortly after the first paint.
  useEffect(() => {
    if (!thread?.loaded) return undefined;
    const t = setTimeout(() => setCascade(false), 700);
    return () => clearTimeout(t);
  }, [thread?.loaded]);

  const scrollToBottom = useCallback((behavior = "auto") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Keep the viewport stable: first open, older pages, new messages.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !thread?.loaded) return;
    const first = rows.find((r) => r.message)?.key;
    const last = [...rows].reverse().find((r) => r.message);

    if (!initialDone.current) {
      initialDone.current = true;
      firstKey.current = first;
      lastKey.current = last?.key;
      const divider = el.querySelector("[data-unread-divider]");
      if (divider) el.scrollTop = Math.max(0, divider.offsetTop - el.clientHeight * 0.25);
      else el.scrollTop = el.scrollHeight;
      return;
    }

    if (pendingJump.current) {
      firstKey.current = first;
      lastKey.current = last?.key;
      return;
    }

    if (prepend.current && first !== firstKey.current) {
      const { height, top } = prepend.current;
      el.scrollTop = el.scrollHeight - height + top;
      prepend.current = null;
    }
    firstKey.current = first;

    if (last && last.key !== lastKey.current) {
      const fromMe = last.message.sender === me._id;
      if (nearBottom.current || (fromMe && last.message.fresh)) {
        scrollToBottom(nearBottom.current ? "smooth" : "auto");
      } else if (!fromMe) {
        setUnseen((n) => n + 1);
      }
    }
    lastKey.current = last?.key;
  }, [rows, thread?.loaded, me._id, scrollToBottom]);

  // Typing bubble appearing at the bottom shouldn't hide behind the fold.
  const typers = Object.keys(typing || {}).filter((id) => id !== me._id);
  useEffect(() => {
    if (typers.length && nearBottom.current) scrollToBottom("smooth");
  }, [typers.length, scrollToBottom]);

  // Jump to a message (reply quote, search result, reminder link).
  useEffect(() => {
    if (!jump || jump.conversationId !== conv._id) return undefined;
    pendingJump.current = jump.nonce;
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (jump.messageId === "__latest__") {
        scrollToBottom("smooth");
      } else {
        const target = el.querySelector(`[data-mid="${CSS.escape(jump.messageId)}"]`);
        if (target) {
          target.scrollIntoView({ block: "center", behavior: "smooth" });
          target.classList.remove("anim-flash");
          void target.offsetWidth;
          target.classList.add("anim-flash");
        }
      }
      setTimeout(() => {
        if (pendingJump.current === jump.nonce) pendingJump.current = null;
      }, 600);
    });
    return () => cancelAnimationFrame(raf);
  }, [jump, conv._id, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !thread) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottom.current = dist < 160;
    setShowJump(dist > 480 || thread.hasNewer);
    if (dist < 160 && unseen) setUnseen(0);

    if (el.scrollTop < 600 && thread.hasMore && !thread.loadingOlder && thread.loaded) {
      prepend.current = { height: el.scrollHeight, top: el.scrollTop };
      useChatStore.getState().loadOlder(conv._id);
    }
    if (dist < 400 && thread.hasNewer && !thread.loadingNewer) useChatStore.getState().loadNewer(conv._id);

    // Floating date pill while scrolling (like a native messenger).
    const dividers = el.querySelectorAll("[data-day]");
    let label = null;
    for (const d of dividers) {
      if (d.offsetTop - el.scrollTop <= 8) label = d.dataset.day;
      else break;
    }
    if (label) setFloatingDate(label);
    clearTimeout(dateTimer.current);
    dateTimer.current = setTimeout(() => setFloatingDate(null), 1100);
  };

  // Auto-translate incoming messages (batched, cached server-side).
  useEffect(() => {
    if (!autoTranslate || !ai) return undefined;
    const lang = me.settings?.language || "en";
    const ids = items
      .filter((m) => m.type === "user" && m.sender !== me._id && m.text && !m.deletedAt && !m.status && !translations[m._id])
      .slice(-30)
      .map((m) => m._id);
    if (!ids.length) return undefined;
    const t = setTimeout(() => useChatStore.getState().translate(ids, lang), 600);
    return () => clearTimeout(t);
  }, [autoTranslate, ai, items, translations, me._id, me.settings?.language]);

  const actions = useMemo(
    () => ({
      nameOf,
      onReply: (m) => useChatStore.getState().setReplyTo(conv._id, m),
      onReact: (m, emoji) => useChatStore.getState().react(conv._id, m._id, emoji),
      onReactMenu: (m, anchorEl) => setMenu({ message: m, anchor: anchorEl, reactionsOnly: true }),
      onMenu: (m, anchorEl, touch = false) => setMenu({ message: m, anchor: anchorEl, touch }),
      onJump: (messageId) => useChatStore.getState().jumpToMessage(conv._id, messageId),
      onOpenMedia: (m, media, index) =>
        useUIStore.getState().open("lightbox", { items: media.map((a) => ({ ...a, sender: nameOf(m.sender), at: m.createdAt })), index }),
      onRetry: (m) => useChatStore.getState().retryMessage(conv._id, m.clientId),
      onTranscribe: async (m) => {
        try {
          await api.post("/ai/transcribe", { messageId: m._id });
        } catch (err) {
          toast.error(errorMessage(err, "Couldn't transcribe this message"));
        }
      },
    }),
    [conv._id, nameOf]
  );

  const peer = peerOf(conv, me._id);
  const callBack = (type) => {
    if (!peer || peer.deleted || conv.blocked) return;
    useCallStore.getState().startCall(conv, peer, type);
  };

  const messageRowCount = rows.filter((r) => r.message).length;
  let messageIndex = 0;
  const typingNames = typers.map((id) => firstName(membersById.get(id)?.fullName)).join(", ");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className={`wallpaper-${wallpaper} overflow-anchor-none relative min-h-0 flex-1 overflow-y-auto overscroll-contain`}>
        {!thread?.loaded ? (
          thread?.error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-base-content/60">{thread.error}</p>
              <button type="button" className="btn btn-sm rounded-xl" onClick={() => useChatStore.getState().loadLatest(conv._id)}>
                Try again
              </button>
            </div>
          ) : (
            <MessagesSkeleton />
          )
        ) : (
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end pb-3 pt-2">
            {thread.loadingOlder && (
              <div className="flex justify-center py-3">
                <Spinner className="size-5 text-base-content/40" />
              </div>
            )}
            {!thread.hasMore && <ChatIntro conv={conv} peer={peer} />}
            {anchor?.count >= 6 && ai && <CatchUpCard conv={conv} anchor={anchor} />}

            {rows.map((row) => {
              if (row.kind === "date") return <DateDivider key={row.key} label={row.label} />;
              if (row.kind === "unread") return <UnreadDivider key={row.key} count={row.count} />;
              const index = messageIndex++;
              const c = cascade && index >= messageRowCount - CASCADE_ROWS ? index - (messageRowCount - CASCADE_ROWS) : undefined;
              if (row.kind === "system") return <SystemRow key={row.key} message={row.message} conv={conv} meId={me._id} cascade={c} />;
              if (row.kind === "call") return <CallRow key={row.key} message={row.message} meId={me._id} onCallBack={callBack} cascade={c} />;
              const m = row.message;
              return (
                <MessageBubble
                  key={row.key}
                  message={m}
                  mine={row.mine}
                  meId={me._id}
                  groupStart={row.groupStart}
                  groupEnd={row.groupEnd}
                  showName={isGroup && row.groupStart}
                  showAvatar={isGroup && row.groupEnd}
                  sender={membersById.get(m.sender)}
                  isGroup={isGroup}
                  receipt={row.mine ? receiptFor(m, conv) : undefined}
                  translation={translations[m._id]}
                  query={searchQuery}
                  canTranscribe={transcription}
                  cascade={c}
                  actions={actions}
                />
              );
            })}

            {typers.length > 0 && <TypingBubble names={typingNames} isGroup={isGroup} />}
          </div>
        )}
      </div>

      {floatingDate && (
        <div className="anim-fade pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
          <span className="rounded-full bg-base-100/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-base-content/60 shadow-soft backdrop-blur">{floatingDate}</span>
        </div>
      )}

      {showJump && (
        <button
          type="button"
          onClick={() => {
            setUnseen(0);
            if (thread?.hasNewer) useChatStore.getState().jumpToLatest(conv._id);
            else scrollToBottom("smooth");
          }}
          className="anim-scale-in absolute bottom-3 right-3 z-10 flex size-11 items-center justify-center rounded-full border border-base-300 bg-base-100 text-base-content/70 shadow-float transition hover:text-base-content md:right-5"
          aria-label="Jump to latest message"
        >
          <ArrowDown className="size-5" />
          {unseen > 0 && (
            <span key={unseen} className="anim-bump absolute -top-1.5 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-content">
              {unseen}
            </span>
          )}
        </button>
      )}

      <MessageMenu conv={conv} state={menu} onClose={() => setMenu(null)} />
    </div>
  );
}

/** Shown at the very top of a conversation's history. */
function ChatIntro({ conv, peer }) {
  return (
    <div className="mx-auto my-6 max-w-xs px-4 text-center">
      <p className="rounded-2xl bg-base-100/90 px-4 py-3 text-xs leading-relaxed text-base-content/55 shadow-sm backdrop-blur">
        {conv.type === "group"
          ? `This is the start of “${conv.name}”.`
          : peer?.deleted
            ? "This account has been deleted."
            : `This is the beginning of your chat with ${peer?.fullName || "this contact"}.`}{" "}
        Messages travel over an encrypted connection.
      </p>
    </div>
  );
}
