import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Ban,
  Download,
  EllipsisVertical,
  Eraser,
  Heart,
  HeartOff,
  Info,
  Languages,
  LogOut,
  Phone,
  Search,
  ShieldCheck,
  Target,
  Timer,
  Trash2,
  Video,
  X,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import Menu from "../ui/Menu";
import { confirmBlock, confirmClear, confirmDelete, muteItems } from "./conversationActions";
import { useIsWide } from "../../hooks/useMediaQuery";
import { useNow } from "../../hooks/useNow";
import { errorMessage } from "../../lib/api";
import { firstName, formatLastSeen, formatUntil } from "../../lib/format";
import { disappearingLabel } from "../../lib/preview";
import { differentZone, isValidTz, myTimezone, timeIn } from "../../lib/time";
import { setNavDirection } from "../../lib/transitions";
import { useAuthStore } from "../../store/useAuthStore";
import { useCallStore } from "../../store/useCallStore";
import { conversationTitle, peerOf, useChatStore } from "../../store/useChatStore";
import { useAiEnabled } from "../../store/useConfigStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUIStore } from "../../store/useUIStore";

const TIMERS = [0, 86400, 604800, 7776000];

function useSubtitle(conv, peer, me) {
  const typing = useChatStore((s) => s.typing[conv._id]);
  const presence = useAuthStore((s) => (peer ? s.presence[peer._id] : null));
  useNow(30000);

  if (conv.type === "self") return { text: "Notes, links and files for yourself" };

  const typers = Object.entries(typing || {}).filter(([id]) => id !== me._id);
  if (typers.length) {
    const recording = typers.some(([, v]) => v.recording);
    if (conv.type === "direct") return { text: recording ? "recording audio…" : "typing…", tone: "primary" };
    const names = typers.map(([id]) => firstName(conv.members.find((m) => m.user._id === id)?.user.fullName));
    return { text: names.length > 2 ? `${names.length} people are typing…` : `${names.join(", ")} ${recording ? "recording" : "typing"}…`, tone: "primary" };
  }

  if (conv.type === "group") {
    const others = conv.members.filter((m) => m.user._id !== me._id).map((m) => firstName(m.user.fullName));
    const shown = others.slice(0, 4).join(", ");
    return { text: `${shown}${others.length > 4 ? ` +${others.length - 4}` : ""}${others.length ? ", you" : "Only you"}` };
  }

  if (!peer || peer.deleted) return { text: "Deleted account" };
  if (conv.blocked) return { text: "Blocked" };
  const parts = [];
  if (presence?.online) parts.push({ text: "online", tone: "success" });
  else if (peer.presenceVisible) parts.push({ text: formatLastSeen(presence?.lastSeen || peer.lastSeen) });
  if (peer.focusUntil && new Date(peer.focusUntil) > new Date()) parts.push({ text: `Focusing ${formatUntil(peer.focusUntil)}`, icon: Target });
  else if (peer.status?.text || peer.status?.emoji) parts.push({ text: `${peer.status.emoji ? `${peer.status.emoji} ` : ""}${peer.status.text}`.trim() });
  if (isValidTz(peer.timezone) && differentZone(peer.timezone, myTimezone())) parts.push({ text: `${timeIn(peer.timezone)} their time` });
  return { parts };
}

export default function ChatHeader({ conv }) {
  const me = useAuthStore((s) => s.authUser);
  const navigate = useNavigate();
  const wide = useIsWide();
  const ai = useAiEnabled();
  const autoTranslate = useSettingsStore((s) => Boolean(s.autoTranslate[conv._id]));
  const callStatus = useCallStore((s) => s.status);
  const peer = peerOf(conv, me._id);
  const online = useAuthStore((s) => Boolean(peer && s.presence[peer._id]?.online));
  const title = conversationTitle(conv, me._id);
  const subtitle = useSubtitle(conv, peer, me);
  const [menu, setMenu] = useState(null);
  const [timerMenu, setTimerMenu] = useState(null);
  const ui = useUIStore.getState();
  const self = conv.type === "self";
  const group = conv.type === "group";

  const goBack = () => {
    if (!wide) setNavDirection("back");
    navigate("/chat", { viewTransition: true });
  };

  const call = (type) => {
    if (conv.blocked) return toast.error("Unblock this contact to call them.");
    if (!peer || peer.deleted) return;
    if (callStatus !== "idle") return toast.error("You're already in a call.");
    useCallStore.getState().startCall(conv, peer, type);
  };

  const exportChat = async () => {
    const id = toast.loading("Preparing export…");
    try {
      await useChatStore.getState().exportChat(conv);
      toast.success("Chat exported", { id });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't export this chat"), { id });
    }
  };

  const canEditTimer = conv.type === "direct" || conv.me.role === "admin";
  const items = [
    { key: "info", label: group ? "Group info" : self ? "Chat info" : "Contact info", icon: Info, onSelect: () => ui.open("infoOpen") },
    !wide && { key: "search", label: "Search", icon: Search, onSelect: () => ui.open("searchOpen") },
    {
      key: "fav",
      label: conv.me.favorite ? "Remove from favorites" : "Add to favorites",
      icon: conv.me.favorite ? HeartOff : Heart,
      onSelect: () => useChatStore.getState().toggleFavorite(conv).catch((err) => toast.error(errorMessage(err))),
    },
    "divider",
    ...(self ? [] : muteItems(conv)),
    canEditTimer && {
      key: "timer",
      label: "Disappearing messages",
      hint: conv.disappearingSeconds ? disappearingLabel(conv.disappearingSeconds) : "Off",
      icon: Timer,
      onSelect: () => setTimerMenu({ anchor: menu?.anchor }),
    },
    ai &&
      !self && {
        key: "translate",
        label: "Translate automatically",
        icon: Languages,
        checked: autoTranslate,
        onSelect: () => {
          useSettingsStore.getState().setAutoTranslate(conv._id, !autoTranslate);
          toast(autoTranslate ? "Auto-translate off" : "Messages in other languages will be translated");
        },
      },
    { key: "export", label: "Export chat", icon: Download, onSelect: exportChat },
    "divider",
    { key: "clear", label: "Clear chat", icon: Eraser, onSelect: () => confirmClear(conv) },
    conv.type === "direct" &&
      peer &&
      !peer.deleted && {
        key: "block",
        label: conv.blocked ? "Unblock" : "Block",
        icon: conv.blocked ? ShieldCheck : Ban,
        danger: !conv.blocked,
        onSelect: () => confirmBlock(conv),
      },
    {
      key: "delete",
      label: group ? "Exit group" : "Delete chat",
      icon: group ? LogOut : Trash2,
      danger: true,
      onSelect: () => confirmDelete(conv, () => navigate("/chat", { replace: true })),
    },
    wide && "divider",
    wide && { key: "close", label: "Close chat", icon: X, onSelect: goBack },
  ];

  const setTimer = async (seconds) => {
    try {
      await useChatStore.getState().setDisappearing(conv._id, seconds);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <header className="safe-top z-20 shrink-0 border-b border-base-300/70 bg-base-100">
      <div className="flex h-header items-center gap-1 px-2 md:px-3">
        <button type="button" className="icon-btn" onClick={goBack} aria-label={wide ? "Close chat" : "Back to chats"} title={wide ? "Close chat (Esc)" : "Back"}>
          <ArrowLeft className="size-[22px]" />
        </button>
        <button
          type="button"
          onClick={() => (useUIStore.getState().infoOpen ? ui.close("infoOpen") : ui.open("infoOpen"))}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 text-left transition hover:bg-base-content/[0.04]"
          aria-label={`${title} — show details`}
        >
          <Avatar
            src={group ? conv.avatar : peer?.profilePic}
            name={title}
            seed={group ? conv._id : peer?._id}
            group={group}
            self={self}
            size={40}
            online={online}
            transitionName={wide ? undefined : "chat-avatar"}
          />
          <span className="min-w-0">
            <span className="block truncate text-[1rem] font-semibold leading-tight" style={wide ? undefined : { viewTransitionName: "chat-title" }}>
              {title}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-tight text-base-content/55">
              {subtitle.parts ? (
                subtitle.parts.map((p, i) => (
                  <span key={p.text} className={`flex min-w-0 shrink items-center gap-1 truncate ${p.tone === "success" ? "font-medium text-success" : ""}`}>
                    {i > 0 && <span className="text-base-content/30">·</span>}
                    {p.icon && <p.icon className="size-3 shrink-0" />}
                    <span className="truncate">{p.text}</span>
                  </span>
                ))
              ) : (
                <span className={`truncate ${subtitle.tone === "primary" ? "font-medium text-primary" : ""}`}>{subtitle.text}</span>
              )}
            </span>
          </span>
        </button>

        {conv.type === "direct" && peer && !peer.deleted && (
          <>
            <button type="button" className="icon-btn" onClick={() => call("video")} aria-label="Video call" title="Video call">
              <Video className="size-[21px]" />
            </button>
            <button type="button" className="icon-btn" onClick={() => call("voice")} aria-label="Voice call" title="Voice call">
              <Phone className="size-5" />
            </button>
          </>
        )}
        {wide && (
          <button type="button" className="icon-btn" onClick={() => ui.open("searchOpen")} aria-label="Search messages" title="Search">
            <Search className="size-5" />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={(e) => setMenu({ anchor: e.currentTarget })} aria-label="More options" title="Menu">
          <EllipsisVertical className="size-5" />
        </button>
      </div>

      <Menu open={Boolean(menu)} anchor={menu?.anchor} onClose={() => setMenu(null)} items={items} title={title} />
      <Menu
        open={Boolean(timerMenu)}
        anchor={timerMenu?.anchor}
        onClose={() => setTimerMenu(null)}
        title="Disappearing messages"
        header={<p className="px-3 pb-2 pt-1 text-[0.8125rem] text-base-content/55">New messages in this chat will disappear after the selected time.</p>}
        items={TIMERS.map((s) => ({
          key: `t${s}`,
          label: s ? disappearingLabel(s) : "Off",
          checked: conv.disappearingSeconds === s,
          onSelect: () => setTimer(s),
        }))}
      />
    </header>
  );
}
