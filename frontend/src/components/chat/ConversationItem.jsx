import { memo } from "react";
import { Link, useViewTransitionState } from "react-router-dom";
import { AtSign, BellOff, Pin, Timer } from "lucide-react";
import Avatar from "../ui/Avatar";
import ReceiptIcon from "./ReceiptIcon";
import { useLongPress } from "../../hooks/useLongPress";
import { firstName, formatAgoShort, formatListTime } from "../../lib/format";
import { previewText } from "../../lib/preview";
import { setNavDirection } from "../../lib/transitions";
import { conversationTitle, isMuted, needsReply, peerOf, receiptFor } from "../../store/useChatStore";

function typingLabel(conv, typing, meId) {
  const ids = Object.keys(typing || {}).filter((id) => id !== meId);
  if (!ids.length) return null;
  const recording = ids.some((id) => typing[id]?.recording);
  if (conv.type === "direct") return recording ? "recording audio…" : "typing…";
  const names = ids.map((id) => firstName(conv.members.find((m) => m.user._id === id)?.user.fullName || "Someone"));
  if (names.length > 2) return `${names.length} people are typing…`;
  return `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} ${recording ? "recording" : "typing"}…`;
}

function ConversationItem({ conv, meId, active, typing, draft, online, narrow, onMenu, index, animate }) {
  const to = `/chat/${conv._id}`;
  const transitioning = useViewTransitionState(to);
  const peer = peerOf(conv, meId);
  const title = conversationTitle(conv, meId);
  const last = conv.lastMessage;
  const unread = conv.me.unreadCount || 0;
  const muted = isMuted(conv);
  const waiting = needsReply(conv, meId);
  const typingText = typingLabel(conv, typing, meId);
  const mine = last && last.sender === meId && last.type === "user";
  const longPress = useLongPress((e, target) => onMenu(conv, target));

  let preview;
  if (typingText) {
    preview = <span className="font-medium text-primary">{typingText}</span>;
  } else if (draft && !active) {
    preview = (
      <>
        <span className="font-medium text-primary">Draft: </span>
        {draft}
      </>
    );
  } else if (last) {
    const sender = conv.type === "group" && last.type === "user" && !mine ? conv.members.find((m) => m.user._id === last.sender)?.user : null;
    preview = (
      <>
        {mine && <ReceiptIcon status={receiptFor(last, conv)} className="mr-1 inline size-4 -translate-y-px align-middle" readClass="text-primary" />}
        {sender && <span className="text-base-content/75">{firstName(sender.fullName)}: </span>}
        {previewText(last, { conv, meId })}
      </>
    );
  } else {
    preview = <span className="text-base-content/40">{conv.type === "group" ? "No messages yet" : "Say hello"}</span>;
  }

  return (
    <Link
      to={to}
      viewTransition
      {...longPress}
      onClick={() => narrow && setNavDirection("forward")}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(conv, { x: e.clientX, y: e.clientY });
      }}
      className={`group relative flex select-none items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-150 ${
        active ? "bg-primary/10" : "hover:bg-base-content/[0.04] active:bg-base-content/[0.07]"
      } ${animate ? "anim-cascade" : ""}`}
      style={animate ? { "--i": Math.min(index, 12) } : undefined}
      aria-current={active ? "page" : undefined}
    >
      <Avatar
        src={conv.type === "group" ? conv.avatar : peer?.profilePic}
        name={title}
        seed={conv.type === "group" ? conv._id : peer?._id}
        group={conv.type === "group"}
        size={50}
        online={online}
        transitionName={narrow && transitioning ? "chat-avatar" : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`min-w-0 truncate text-[0.95rem] ${unread ? "font-semibold" : "font-medium"}`}
            style={narrow && transitioning ? { viewTransitionName: "chat-title" } : undefined}
          >
            {title}
          </span>
          {conv.disappearingSeconds > 0 && <Timer className="size-3.5 shrink-0 text-base-content/40" aria-label="Disappearing messages" />}
          <span className={`ml-auto shrink-0 text-xs tabular-nums ${unread && !muted ? "font-semibold text-primary" : waiting ? "text-warning" : "text-base-content/45"}`}>
            {waiting ? `Waiting ${formatAgoShort(last.createdAt)}` : formatListTime(last?.createdAt || conv.lastMessageAt || conv.createdAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className={`min-w-0 flex-1 truncate text-[0.85rem] ${unread ? "text-base-content/85" : "text-base-content/55"}`}>{preview}</p>
          {last?.urgent && last.sender !== meId && unread > 0 && <AtSign className="size-3.5 shrink-0 text-error" aria-label="Urgent" />}
          {muted && <BellOff className="size-3.5 shrink-0 text-base-content/35" aria-label="Muted" />}
          {conv.me.pinnedAt && !unread && <Pin className="size-3.5 shrink-0 rotate-45 text-base-content/35" aria-label="Pinned" />}
          {unread > 0 && (
            <span
              key={unread}
              className={`anim-bump flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                muted ? "bg-base-content/20 text-base-content" : "bg-primary text-primary-content"
              }`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default memo(ConversationItem);
