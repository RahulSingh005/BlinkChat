import { memo, useRef, useState } from "react";
import { Ban, CalendarClock, CircleAlert, Forward, Languages, Reply, SmilePlus, Siren, EllipsisVertical, AudioLines } from "lucide-react";
import Avatar from "../ui/Avatar";
import FileCard from "./FileCard";
import MediaGrid from "./MediaGrid";
import ReceiptIcon from "./ReceiptIcon";
import VoicePlayer from "./VoicePlayer";
import { useLongPress } from "../../hooks/useLongPress";
import { nameColor } from "../../lib/avatar";
import { formatTime } from "../../lib/format";
import { vibrate } from "../../lib/platform";
import { isEmojiOnly, renderMessageText } from "../../lib/text";


const KIND_LABEL = { image: "Photo", video: "Video", audio: "Voice message", file: "File", call: "Call" };

function Meta({ m, mine, receipt, onMedia = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] leading-none ${
        onMedia ? "rounded-full bg-black/45 px-1.5 py-1 text-white" : mine ? "text-primary-content/75" : "text-base-content/45"
      }`}
    >
      {m.scheduled && <CalendarClock className="size-3" aria-label="Scheduled" />}
      {m.editedAt && !m.deletedAt && <span>edited</span>}
      <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
      {mine && <ReceiptIcon status={receipt} className="size-[15px]" readClass={onMedia ? "text-cyan-300" : "text-cyan-200"} />}
    </span>
  );
}

function ReplyQuote({ reply, mine, nameOf, onJump }) {
  const color = mine ? undefined : nameColor(reply.sender);
  const label = reply.text || KIND_LABEL[reply.kind] || "Message";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump(reply.message);
      }}
      className={`mx-1 mt-1 flex min-w-[150px] gap-2 overflow-hidden rounded-[10px] py-1.5 pl-2 pr-3 text-left transition ${
        mine ? "bg-primary-content/15 hover:bg-primary-content/20" : "bg-base-content/[0.05] hover:bg-base-content/[0.08]"
      }`}
    >
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: color || "currentColor", opacity: mine ? 0.7 : 1 }} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold" style={{ color }}>
          {nameOf(reply.sender)}
        </span>
        <span className="line-clamp-2 text-[0.8125rem] opacity-80">{label}</span>
      </span>
    </button>
  );
}

function Reactions({ reactions, meId, mine, nameOf, onReact }) {
  const groups = [];
  for (const r of reactions) {
    let g = groups.find((x) => x.emoji === r.emoji);
    if (!g) groups.push((g = { emoji: r.emoji, users: [] }));
    g.users.push(r.user);
  }
  return (
    <div className={`relative z-[1] -mt-2 flex flex-wrap gap-1 px-2 ${mine ? "justify-end" : "justify-start"}`}>
      {groups.map((g) => {
        const byMe = g.users.includes(meId);
        return (
          <button
            key={g.emoji}
            type="button"
            onClick={() => onReact(g.emoji)}
            title={g.users.map(nameOf).join(", ")}
            className={`anim-reaction flex h-6 items-center gap-1 rounded-full border px-1.5 text-[13px] leading-none shadow-sm transition active:scale-95 ${
              byMe ? "border-primary/40 bg-primary/15" : "border-base-300 bg-base-100"
            }`}
          >
            <span>{g.emoji}</span>
            {g.users.length > 1 && <span className="text-[11px] font-semibold text-base-content/70">{g.users.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message: m,
  mine,
  meId,
  groupStart,
  groupEnd,
  showName,
  showAvatar,
  sender,
  isGroup,
  receipt,
  translation,
  query,
  canTranscribe,
  cascade,
  actions,
}) {
  const [dx, setDx] = useState(0);
  const swipe = useRef(null);
  const longPress = useLongPress((e, target) => actions.onMenu(m, target, true));

  const deleted = Boolean(m.deletedAt);
  const media = m.attachments.filter((a) => a.kind === "image" || a.kind === "video");
  const audio = m.attachments.find((a) => a.kind === "audio");
  const files = m.attachments.filter((a) => a.kind === "file");
  const hasText = Boolean(m.text) && !deleted;
  const bigEmoji = hasText && !m.attachments.length && !m.replyTo && isEmojiOnly(m.text);
  const mediaOnly = media.length > 0 && !hasText && !audio && !files.length;
  const uploading = m.status === "pending" && m.attachments.some((a) => a.local);

  const anim = cascade !== undefined ? "anim-cascade" : m.fresh ? (mine ? "anim-pop" : "anim-in-left") : "";
  const radius = mine ? (groupEnd ? "rounded-[18px] rounded-br-[6px]" : "rounded-[18px]") : groupEnd ? "rounded-[18px] rounded-bl-[6px]" : "rounded-[18px]";
  const surface = bigEmoji
    ? ""
    : mine
      ? "bg-primary text-primary-content shadow-bubble"
      : "border border-bubble-in-border/70 bg-bubble-in text-base-content shadow-bubble";

  // Swipe right to reply (touch).
  const onPointerDown = (e) => {
    longPress.onPointerDown(e);
    if (e.pointerType === "mouse" || deleted || m.status) return;
    swipe.current = { x: e.clientX, y: e.clientY, active: false, buzzed: false };
  };
  const onPointerMove = (e) => {
    longPress.onPointerMove(e);
    const s = swipe.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (!s.active) {
      if (ddx > 14 && Math.abs(ddx) > Math.abs(ddy) * 1.6) s.active = true;
      else if (Math.abs(ddy) > 12 || ddx < -12) {
        swipe.current = null;
        return;
      }
    }
    if (s.active) {
      const v = Math.min(84, ddx * 0.55);
      setDx(v);
      if (v > 56 && !s.buzzed) {
        s.buzzed = true;
        vibrate(8);
      }
    }
  };
  const endSwipe = (e) => {
    longPress.onPointerUp(e);
    if (swipe.current?.active && dx > 56) actions.onReply(m);
    swipe.current = null;
    setDx(0);
  };

  return (
    <div
      data-mid={m._id}
      className={`group/row relative flex items-end gap-2 rounded-xl px-2 md:px-4 ${mine ? "justify-end" : "justify-start"} ${groupStart ? "mt-2" : "mt-[3px]"} ${anim}`}
      style={{ "--i": cascade, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
      onClickCapture={longPress.onClickCapture}
      onContextMenu={(e) => {
        if (e.nativeEvent.pointerType === "touch") {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        actions.onMenu(m, { x: e.clientX, y: e.clientY });
      }}
    >
      {/* swipe-to-reply affordance */}
      {dx > 0 && (
        <span
          className="absolute left-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-base-content/10 text-base-content/70"
          style={{ opacity: Math.min(1, dx / 56), transform: `translateY(-50%) scale(${0.6 + Math.min(0.4, dx / 140)})` }}
        >
          <Reply className="size-4" />
        </span>
      )}

      {isGroup && !mine && (
        <div className="w-8 shrink-0 self-end">
          {showAvatar && <Avatar src={sender?.profilePic} name={sender?.fullName} seed={m.sender} size={32} />}
        </div>
      )}

      <div
        className={`relative flex min-w-0 max-w-[min(80%,34rem)] flex-col ${mine ? "items-end" : "items-start"}`}
        style={dx ? { transform: `translateX(${dx}px)` } : { transition: "transform 0.25s var(--spring)" }}
      >
        <div
          className={`relative min-w-0 max-w-full overflow-hidden ${radius} ${surface} ${
            m.status === "failed" ? "opacity-70" : ""
          } [-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none`}
        >
          {showName && !mine && !bigEmoji && (
            <div className="truncate px-3 pt-1.5 text-[0.8125rem] font-semibold" style={{ color: nameColor(m.sender) }}>
              {sender?.fullName || "Deleted account"}
            </div>
          )}
          {(m.forwarded || m.urgent) && !deleted && (
            <div className={`flex items-center gap-1 px-3 pt-1.5 text-[11px] font-medium ${mine ? "text-primary-content/75" : "text-base-content/50"}`}>
              {m.urgent && (
                <span className={`flex items-center gap-1 rounded px-1 py-px font-bold uppercase tracking-wide ${mine ? "bg-primary-content/20" : "bg-error/15 text-error"}`}>
                  <Siren className="size-3" /> Urgent
                </span>
              )}
              {m.forwarded && (
                <span className="flex items-center gap-1 italic">
                  <Forward className="size-3" /> Forwarded
                </span>
              )}
            </div>
          )}

          {deleted ? (
            <div className={`flex items-center gap-1.5 px-3 py-2 text-[0.9rem] italic ${mine ? "text-primary-content/80" : "text-base-content/50"}`}>
              <Ban className="size-4" />
              This message was deleted
              <span className="ml-1 not-italic">
                <Meta m={m} mine={mine} receipt={receipt} />
              </span>
            </div>
          ) : (
            <>
              {m.replyTo && <ReplyQuote reply={m.replyTo} mine={mine} nameOf={actions.nameOf} onJump={actions.onJump} />}

              {media.length > 0 && (
                <div className={`relative ${m.replyTo || showName || m.forwarded ? "mt-1" : ""}`}>
                  <MediaGrid attachments={media} uploading={uploading} onOpen={(i) => actions.onOpenMedia(m, media, i)} />
                  {mediaOnly && (
                    <span className="pointer-events-none absolute bottom-1.5 right-1.5">
                      <Meta m={m} mine={mine} receipt={receipt} onMedia />
                    </span>
                  )}
                </div>
              )}

              {audio && (
                <div className="px-2 pt-1.5">
                  <VoicePlayer att={audio} mine={mine} />
                  {m.transcript ? (
                    <p className={`mt-1 border-t px-1 pb-0.5 pt-1.5 text-[0.85rem] leading-snug ${mine ? "border-primary-content/20" : "border-base-content/10"}`}>
                      {m.transcript}
                    </p>
                  ) : (
                    canTranscribe &&
                    !m.status && (
                      <button
                        type="button"
                        onClick={() => actions.onTranscribe(m)}
                        className={`mt-1 flex items-center gap-1 px-1 text-xs font-medium ${mine ? "text-primary-content/80" : "text-primary"}`}
                      >
                        <AudioLines className="size-3.5" /> Transcribe
                      </button>
                    )
                  )}
                </div>
              )}

              {files.length > 0 && (
                <div className="space-y-1 px-1.5 pt-1.5">
                  {files.map((f, i) => (
                    <FileCard key={`${f.url}-${i}`} att={f} mine={mine} />
                  ))}
                </div>
              )}

              {hasText ? (
                <div className={`msg-text relative ${bigEmoji ? "msg-big-emoji px-1" : "px-3 pb-[7px] pt-[6px] text-[0.95rem]"}`}>
                  {renderMessageText(m.text, { query })}
                  {bigEmoji ? (
                    <span className="block text-right">
                      <Meta m={m} mine={false} receipt={receipt} />
                    </span>
                  ) : (
                    <>
                      <span className="invisible ml-2 inline-flex select-none" aria-hidden="true">
                        <Meta m={m} mine={mine} receipt={receipt} />
                      </span>
                      <span className="absolute bottom-[5px] right-2.5">
                        <Meta m={m} mine={mine} receipt={receipt} />
                      </span>
                    </>
                  )}
                </div>
              ) : (
                !mediaOnly && (
                  <div className="flex justify-end px-3 pb-1.5 pt-1">
                    <Meta m={m} mine={mine} receipt={receipt} />
                  </div>
                )
              )}

              {translation && !mine && (translation.text || translation.loading) && (
                <div className="mx-3 mb-2 border-t border-base-content/10 pt-1.5">
                  <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-base-content/45">
                    <Languages className="size-3" /> Translated
                  </div>
                  {translation.loading ? (
                    <div className="space-y-1.5 py-1">
                      <div className="skeleton-line h-2.5 w-44" />
                      <div className="skeleton-line h-2.5 w-28" />
                    </div>
                  ) : (
                    <p className="msg-text text-[0.92rem]">{translation.text}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {m.reactions?.length > 0 && !deleted && (
          <Reactions reactions={m.reactions} meId={meId} mine={mine} nameOf={actions.nameOf} onReact={(emoji) => actions.onReact(m, emoji)} />
        )}

        {m.status === "failed" && (
          <button type="button" onClick={() => actions.onRetry(m)} className="mt-1 flex items-center gap-1 text-xs font-medium text-error">
            <CircleAlert className="size-3.5" /> Not sent · Tap to retry
          </button>
        )}

        {/* Desktop hover actions */}
        {!deleted && !m.status && (
          <div
            className={`absolute top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-full border border-base-300/80 bg-base-100 p-0.5 opacity-0 shadow-soft transition-opacity duration-150 group-hover/row:opacity-100 [@media(hover:hover)]:flex ${
              mine ? "right-full mr-2" : "left-full ml-2"
            } ${m.reactions?.length ? "-mt-2" : ""}`}
          >
            <button type="button" className="icon-btn icon-btn-sm size-7" onClick={(e) => actions.onReactMenu(m, e.currentTarget)} aria-label="React">
              <SmilePlus className="size-4" />
            </button>
            <button type="button" className="icon-btn icon-btn-sm size-7" onClick={() => actions.onReply(m)} aria-label="Reply">
              <Reply className="size-4" />
            </button>
            <button type="button" className="icon-btn icon-btn-sm size-7" onClick={(e) => actions.onMenu(m, e.currentTarget)} aria-label="More actions">
              <EllipsisVertical className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
