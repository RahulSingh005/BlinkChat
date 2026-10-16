import { lazy, Suspense, useState } from "react";
import toast from "react-hot-toast";
import { AlarmClock, Copy, Forward, Languages, Pencil, Plus, Reply, RotateCcw, Trash2 } from "lucide-react";
import Menu from "../ui/Menu";
import { QUICK_REACTIONS } from "../../lib/reactions";
import { errorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatStore } from "../../store/useChatStore";
import { useAiEnabled, useConfigStore } from "../../store/useConfigStore";
import { useUIStore } from "../../store/useUIStore";

const EmojiPopover = lazy(() => import("../ui/EmojiPopover"));

function QuickReactions({ current, onPick, onMore }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-1 px-1 pb-1.5 pt-1">
      {QUICK_REACTIONS.map((emoji, i) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className={`anim-reaction flex size-10 items-center justify-center rounded-full text-[22px] transition hover:scale-110 hover:bg-base-content/[0.06] active:scale-95 ${
            current === emoji ? "bg-primary/15" : ""
          }`}
          style={{ animationDelay: `${i * 25}ms` }}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      <button type="button" onClick={onMore} className="flex size-10 items-center justify-center rounded-full bg-base-content/[0.06] text-base-content/60 transition hover:bg-base-content/10" aria-label="More reactions">
        <Plus className="size-5" />
      </button>
    </div>
  );
}

/** Reactions + actions for one message (popover on desktop, sheet on phones). */
export default function MessageMenu({ conv, state, onClose }) {
  const me = useAuthStore((s) => s.authUser);
  const ai = useAiEnabled();
  const editWindow = useConfigStore((s) => s.config?.limits?.editWindowMs || 24 * 3600 * 1000);
  const translation = useChatStore((s) => (state ? s.translations[state.message._id] : null));
  const [picker, setPicker] = useState(null);

  const m = state?.message;
  if (!m && !picker) return null;

  const chat = useChatStore.getState();
  const ui = useUIStore.getState();
  const mine = m?.sender === me._id;
  const deleted = Boolean(m?.deletedAt);
  const pending = Boolean(m?.status);
  const myReaction = m?.reactions?.find((r) => r.user === me._id)?.emoji;

  const react = (emoji) => {
    chat.react(conv._id, m._id, emoji);
    onClose();
  };

  const remove = async () => {
    const admin = conv.type === "group" && conv.me.role === "admin";
    const canEveryone = !deleted && (mine || admin);
    const answer = await ui.ask({
      title: "Delete message?",
      body: canEveryone ? "" : "This removes it from your devices only.",
      confirmLabel: "Delete",
      danger: true,
      checkbox: canEveryone ? (mine ? "Also delete for everyone" : "Delete for everyone (as admin)") : null,
    });
    if (!answer) return;
    const scope = answer.checked ? "everyone" : "me";
    try {
      await chat.deleteMessage(conv._id, m._id, scope);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete"));
    }
  };

  const items = !m
    ? []
    : pending
      ? [
          m.status === "failed" && { key: "retry", label: "Retry sending", icon: RotateCcw, onSelect: () => chat.retryMessage(conv._id, m.clientId) },
          { key: "discard", label: "Discard", icon: Trash2, danger: true, onSelect: () => chat.discardMessage(conv._id, m.clientId) },
        ]
      : [
          !deleted && !conv.blocked && { key: "reply", label: "Reply", icon: Reply, onSelect: () => chat.setReplyTo(conv._id, m) },
          m.text && !deleted && {
            key: "copy",
            label: "Copy text",
            icon: Copy,
            onSelect: async () => {
              try {
                await navigator.clipboard.writeText(m.text);
                toast.success("Copied");
              } catch {
                toast.error("Couldn't copy");
              }
            },
          },
          mine && m.text && !deleted && !m.forwarded && Date.now() - new Date(m.createdAt).getTime() < editWindow && {
            key: "edit",
            label: "Edit",
            icon: Pencil,
            onSelect: () => chat.setEditing(conv._id, m),
          },
          !deleted && { key: "forward", label: "Forward", icon: Forward, onSelect: () => ui.open("forward", m) },
          !deleted && { key: "remind", label: "Remind me", icon: AlarmClock, onSelect: () => ui.open("remind", m) },
          ai && m.text && !mine && !deleted && {
            key: "translate",
            label: translation?.text ? "Show original" : "Translate",
            icon: Languages,
            onSelect: () =>
              translation?.text ? chat.hideTranslation(m._id) : chat.translate([m._id], me.settings?.language || "en"),
          },
          "divider",
          { key: "delete", label: "Delete", icon: Trash2, danger: true, onSelect: remove },
        ];

  const showReactions = m && !deleted && !pending && !conv.blocked;

  return (
    <>
      <Menu
        open={Boolean(m)}
        anchor={state?.anchor}
        onClose={onClose}
        width={272}
        items={state?.reactionsOnly ? [] : items}
        header={
          showReactions ? (
            <QuickReactions
              current={myReaction}
              onPick={react}
              onMore={() => {
                setPicker({ anchor: state.anchor, message: m });
                onClose();
              }}
            />
          ) : null
        }
      />
      {picker && (
        <Suspense fallback={null}>
          <EmojiPopover
            anchor={picker.anchor}
            onClose={() => setPicker(null)}
            onPick={(emoji) => chat.react(conv._id, picker.message._id, emoji)}
          />
        </Suspense>
      )}
    </>
  );
}
