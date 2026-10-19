import { memo, useRef, useState } from "react";
import { AudioLines, Ban, CalendarClock, CircleAlert, EllipsisVertical, Forward, Languages, Reply, Siren, SmilePlus, Star } from "lucide-react";
import Avatar from "../ui/Avatar";
import FileCard from "./FileCard";
import MediaGrid from "./MediaGrid";
import ReceiptIcon from "./ReceiptIcon";
import VoicePlayer from "./VoicePlayer";
import { ContactCard, GifMedia, LinkPreviewCard, LocationCard, PollCard, StickerMedia, StoryReplyQuote, ViewOnceTile } from "./RichContent";
import { useLongPress } from "../../hooks/useLongPress";
import { nameColor } from "../../lib/avatar";
import { formatTime } from "../../lib/format";
import { vibrate } from "../../lib/platform";
import { isEmojiOnly, renderMessageText } from "../../lib/text";

const KIND_LABEL = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎤 Voice message",
  file: "📎 File",
  call: "📞 Call",
  gif: "GIF",
  sticker: "Sticker",
  poll: "📊 Poll",
  location: "📍 Location",
  contact: "👤 Contact",
};

function Meta({ m, mine, receipt, onMedia = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] leading-none ${
        onMedia ? "rounded-full bg-black/45 px-1.5 py-1 text-white" : mine ? "text-bubble-out-content/70" : "text-base-content/45"
      }`}
    >
      {m.starred && <Star className="size-3 fill-current" aria-label="Starred" />}
      {m.scheduled && <CalendarClock className="size-3" aria-label="Scheduled" />}
      {m.editedAt && !m.deletedAt && <span>edited</span>}
      <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
      {mine && <ReceiptIcon status={receipt} className="size-4" readClass={onMedia ? "text-sky-300" : "tick-read"} />}
    </span>
  );
}

/** Telegram-style bubble tail on the last message of a group. */
function Tail({ mine }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 9 16"
      width="9"
      height="16"
      fill="currentColor"
      className={`pointer-events-none absolute bottom-0 ${mine ? "-right-2 -scale-x-100 text-bubble-out" : "-left-2 text-bubble-in"}`}
      style={{ filter: "drop-shadow(0 1px 0.5px rgb(0 0 0 / 0.1))" }}
    >
      <path d="M9 0v16H1.6C.7 16 .3 15 .9 14.4 6 9.4 9 5 9 0Z" />
    </svg>
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
        mine ? "bg-bubble-out-content/[0.12] hover:bg-bubble-out-content/[0.18]" : "bg-base-content/[0.05] hover:bg-base-content/[0.08]"
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
    <div className={`relative z-[1] -mt-1.5 flex flex-wrap gap-1 px-2 ${mine ? "justify-end" : "justify-start"}`}>
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
  showLinkPreview = true,
  autoplayGifs = true,
}) {
  const [dx, setDx] = useState(0);
  const swipe = useRef(null);
  const longPress = useLongPress((e, target) => actions.onMenu(m, target, true));

  const deleted = Boolean(m.deletedAt);
  const atts = deleted ? [] : m.attachments || [];
  const viewOnce = m.viewOnce && !deleted;
  const gif = atts.find((a) => a.kind === "gif");
  const sticker = atts.find((a) => a.kind === "sticker");
  const media = viewOnce ? [] : atts.filter((a) => a.kind === "image" || a.kind === "video");
  const audio = atts.find((a) => a.kind === "audio");
  const files = atts.filter((a) => a.kind === "file");
  const hasText = Boolean(m.text) && !deleted;
  const special = !deleted && (m.poll || m.location || m.contactCard);
  const bigEmoji = hasText && !atts.length && !m.replyTo && !special && !m.storyReply && isEmojiOnly(m.text);
  const stickerOnly = Boolean(sticker) && !hasText && !m.replyTo;
  const mediaOnly = (media.length > 0 || Boolean(gif)) && !hasText && !audio && !files.length && !special && !m.replyTo && !m.storyReply;
  const bare = bigEmoji || stickerOnly;
  const tail = groupEnd && !bare && !mediaOnly;
  const uploading = m.status === "pending" && atts.some((a) => a.local);
  const mentionLabels = m.mentions?.length ? m.mentions.map((id) => ({ label: actions.mentionLabel(id), me: id === meId })).filter((x) => x.label) : null;

  const anim = cascade !== undefined ? "anim-cascade" : m.fresh ? (mine ? "anim-pop" : "anim-in-left") : "";
  const corners = mine
    ? `${groupStart ? "" : "rounded-tr-[6px]"} ${tail ? "rounded-br-none" : groupEnd ? "" : "rounded-br-[6px]"}`
    : `${groupStart ? "" : "rounded-tl-[6px]"} ${tail ? "rounded-bl-none" : groupEnd ? "" : "rounded-bl-[6px]"}`;
  const surface = bare ? "" : mine ? "msg-out bg-bubble-out text-bubble-out-content shadow-bubble" : "bg-bubble-in text-base-content shadow-bubble";

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

  const topPad = m.replyTo || showName || m.forwarded || m.urgent || m.storyReply;

  return (
    <div
      data-mid={m._id}
      className={`group/row relative flex items-end gap-2 rounded-xl ${mine ? "justify-end" : "justify-start"} ${groupStart ? "mt-2" : "mt-[3px]"} ${anim}`}
      style={{ "--i": cascade, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
      onClickCapture={longPress.onClickCapture}
      onContextMenu={(e) => {
        e.preventDefault();
        if (e.nativeEvent.pointerType === "touch") return;
        actions.onMenu(m, { x: e.clientX, y: e.clientY });
      }}
    >
      {/* swipe-to-reply affordance */}
      {dx > 0 && (
        <span
          className="absolute left-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-base-content/10 text-base-content/70"
          style={{ opacity: Math.min(1, dx / 56), transform: `translateY(-50%) scale(${0.6 + Math.min(0.4, dx / 140)})` }}
        >
          <Reply className="size-4" />
        </span>
      )}

      {isGroup && !mine && (
        <div className="w-8 shrink-0 self-end">
          {showAvatar && (
            <button type="button" onClick={() => actions.onOpenProfile?.(m.sender)} className="rounded-full" aria-label={`Message ${sender?.fullName || ""}`}>
              <Avatar src={sender?.profilePic} name={sender?.fullName} seed={m.sender} size={32} />
            </button>
          )}
        </div>
      )}

      <div
        className={`relative flex min-w-0 max-w-[86%] flex-col sm:max-w-[75%] lg:max-w-[min(65%,600px)] ${mine ? "items-end" : "items-start"}`}
        style={dx ? { transform: `translateX(${dx}px)` } : { transition: "transform 0.25s var(--spring)" }}
      >
        <div className="relative max-w-full">
          <div
            className={`relative min-w-0 max-w-full overflow-hidden rounded-[18px] ${corners} ${surface} ${
              m.status === "failed" ? "opacity-70" : ""
            } [-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none`}
          >
            {showName && !mine && !bare && (
              <div className="truncate px-3 pt-1.5 text-[0.8125rem] font-semibold" style={{ color: nameColor(m.sender) }}>
                {sender?.fullName || "Deleted account"}
              </div>
            )}
            {(m.forwarded || m.urgent) && !deleted && (
              <div className={`flex items-center gap-1 px-3 pt-1.5 text-[11px] font-medium ${mine ? "text-bubble-out-content/75" : "text-base-content/50"}`}>
                {m.urgent && (
                  <span className={`flex items-center gap-1 rounded px-1 py-px font-bold uppercase tracking-wide ${mine ? "bg-bubble-out-content/20" : "bg-error/15 text-error"}`}>
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
              <div className={`flex items-center gap-1.5 px-3 py-2 text-[0.9rem] italic ${mine ? "text-bubble-out-content/80" : "text-base-content/50"}`}>
                <Ban className="size-4" />
                This message was deleted
                <span className="ml-1 not-italic">
                  <Meta m={m} mine={mine} receipt={receipt} />
                </span>
              </div>
            ) : (
              <>
                {m.storyReply && <StoryReplyQuote reply={m.storyReply} mine={mine} ownerName={actions.nameOf(m.storyReply.owner)} />}
                {m.replyTo && <ReplyQuote reply={m.replyTo} mine={mine} nameOf={actions.nameOf} onJump={actions.onJump} />}

                {stickerOnly ? (
                  <div className="flex flex-col items-end gap-1">
                    <StickerMedia att={sticker} />
                    <Meta m={m} mine={false} receipt={receipt} />
                  </div>
                ) : (
                  <>
                    {(media.length > 0 || gif) && (
                      <div className={`relative ${topPad ? "mt-1" : ""}`}>
                        {gif ? (
                          <GifMedia att={gif} autoplay={autoplayGifs} onOpen={() => actions.onOpenMedia(m, [{ ...gif, kind: "image" }], 0)} />
                        ) : (
                          <MediaGrid attachments={media} uploading={uploading} onOpen={(i) => actions.onOpenMedia(m, media, i)} />
                        )}
                        {mediaOnly && (
                          <span className="pointer-events-none absolute bottom-1.5 right-1.5">
                            <Meta m={m} mine={mine} receipt={receipt} onMedia />
                          </span>
                        )}
                      </div>
                    )}

                    {viewOnce && <ViewOnceTile message={m} mine={mine} meId={meId} onOpen={actions.onOpenViewOnce} />}
                    {m.poll && <PollCard message={m} mine={mine} meId={meId} onVote={actions.onVote} onEnd={actions.onEndPoll} onShowVotes={actions.onShowVotes} />}
                    {m.location && <LocationCard location={m.location} mine={mine} />}
                    {m.contactCard && <ContactCard card={m.contactCard} mine={mine} isMe={m.contactCard.user === meId} onMessage={actions.onMessageContact} />}

                    {audio && (
                      <div className="px-2 pt-1.5">
                        <VoicePlayer att={audio} mine={mine} />
                        {m.transcript ? (
                          <p className={`mt-1 border-t px-1 pb-0.5 pt-1.5 text-[0.85rem] leading-snug ${mine ? "border-bubble-out-content/20" : "border-base-content/10"}`}>{m.transcript}</p>
                        ) : (
                          canTranscribe &&
                          !m.status && (
                            <button
                              type="button"
                              onClick={() => actions.onTranscribe(m)}
                              className={`mt-1 flex items-center gap-1 px-1 text-xs font-medium ${mine ? "text-bubble-out-content/80" : "text-primary"}`}
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

                    {hasText && showLinkPreview && m.linkPreview && <LinkPreviewCard preview={m.linkPreview} mine={mine} />}

                    {hasText ? (
                      <div className={`msg-text relative ${bigEmoji ? "msg-big-emoji px-1" : "px-3 pb-[7px] pt-[6px] text-[0.95rem]"}`}>
                        {renderMessageText(m.text, { query, mentions: mentionLabels })}
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
              </>
            )}
          </div>
          {tail && <Tail mine={mine} />}
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
              mine ? "right-full mr-3" : "left-full ml-3"
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
