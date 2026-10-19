import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from "lucide-react";
import PeoplePicker from "../components/chat/PeoplePicker";
import PanelHeader from "../components/layout/PanelHeader";
import SplitView, { DetailPlaceholder } from "../components/layout/SplitView";
import Avatar from "../components/ui/Avatar";
import Sheet from "../components/ui/Sheet";
import { ConversationSkeleton } from "../components/ui/Skeletons";
import { useIsWide } from "../hooks/useMediaQuery";
import { useNow } from "../hooks/useNow";
import { errorMessage } from "../lib/api";
import { formatDayLabel, formatDuration, formatTime, isSameDay } from "../lib/format";
import { setNavDirection } from "../lib/transitions";
import { isMissed, useCallLogStore } from "../store/useCallLogStore";
import { useCallStore } from "../store/useCallStore";
import { useChatStore } from "../store/useChatStore";

async function startCallWith(user, type) {
  if (useCallStore.getState().status !== "idle") return toast.error("You're already in a call.");
  try {
    const conv = await useChatStore.getState().openDirect(user._id);
    if (conv.blocked) return toast.error("Unblock this contact to call them.");
    useCallStore.getState().startCall(conv, conv.members.find((m) => m.user._id === user._id)?.user || user, type);
  } catch (err) {
    toast.error(errorMessage(err));
  }
  return undefined;
}

function CallRow({ call, onOpen, index }) {
  const missed = isMissed(call);
  const video = call.message.call?.kind === "video";
  const Icon = missed ? PhoneMissed : call.outgoing ? PhoneOutgoing : PhoneIncoming;
  const status = call.message.call?.status;
  const detail =
    status === "completed"
      ? formatDuration(call.message.call.duration)
      : status === "declined"
        ? "Declined"
        : missed
          ? "Missed"
          : call.outgoing
            ? "No answer"
            : "Missed";
  return (
    <div className="anim-cascade flex items-center gap-1 rounded-xl px-2 transition hover:bg-base-content/[0.04]" style={{ "--i": Math.min(index, 12) }}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
        <Avatar src={call.peer.profilePic} name={call.peer.fullName} seed={call.peer._id} size={48} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[0.975rem] font-medium ${missed ? "text-error" : ""}`}>{call.peer.fullName}</span>
          <span className="flex items-center gap-1.5 text-[0.8125rem] text-base-content/55">
            <Icon className={`size-3.5 shrink-0 ${missed ? "text-error" : call.outgoing ? "text-success" : "text-sky-500"}`} />
            <span className="truncate">
              {formatTime(call.message.createdAt)} · {detail}
            </span>
          </span>
        </span>
      </button>
      {!call.peer.deleted && (
        <button
          type="button"
          className="icon-btn text-primary"
          onClick={() => startCallWith(call.peer, video ? "video" : "voice")}
          aria-label={`${video ? "Video" : "Voice"} call ${call.peer.fullName}`}
          title={video ? "Video call" : "Voice call"}
        >
          {video ? <Video className="size-5" /> : <Phone className="size-5" />}
        </button>
      )}
    </div>
  );
}

function NewCallSheet({ open, onClose }) {
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={picked ? `Call ${picked.fullName}` : "New call"} size="md" tall={!picked}>
      {picked ? (
        <div className="flex flex-col items-center gap-5 py-4">
          <Avatar src={picked.profilePic} name={picked.fullName} seed={picked._id} size={88} />
          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              className="btn h-12 min-h-0 rounded-xl"
              onClick={() => {
                onClose();
                startCallWith(picked, "voice");
              }}
            >
              <Phone className="size-5" /> Voice
            </button>
            <button
              type="button"
              className="btn btn-primary h-12 min-h-0 rounded-xl"
              onClick={() => {
                onClose();
                startCallWith(picked, "video");
              }}
            >
              <Video className="size-5" /> Video
            </button>
          </div>
          <button type="button" className="text-sm text-base-content/55 hover:underline" onClick={() => setPicked(null)}>
            Choose someone else
          </button>
        </div>
      ) : (
        <PeoplePicker onPick={setPicked} />
      )}
    </Sheet>
  );
}

function CallsList() {
  const items = useCallLogStore((s) => s.items);
  const loaded = useCallLogStore((s) => s.loaded);
  const hasMore = useCallLogStore((s) => s.hasMore);
  const loadingMore = useCallLogStore((s) => s.loadingMore);
  const [filter, setFilter] = useState("all");
  const [newCall, setNewCall] = useState(false);
  const navigate = useNavigate();
  const wide = useIsWide();
  useNow(60000);

  useEffect(() => {
    useCallLogStore.getState().fetch();
    useCallLogStore.getState().markSeen();
    return () => useCallLogStore.getState().markSeen();
  }, []);

  const shown = useMemo(() => (filter === "missed" ? items.filter(isMissed) : items), [items, filter]);

  const open = (call) => {
    if (!wide) setNavDirection("forward");
    navigate(`/chat/${call.conversationId}`, { viewTransition: true });
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-base-100">
      <PanelHeader
        title="Calls"
        actions={
          <button type="button" className="icon-btn" onClick={() => setNewCall(true)} aria-label="New call" title="New call">
            <PhoneCall className="size-5" />
          </button>
        }
      >
        <div className="flex gap-2 px-4 pb-2.5">
          {[
            ["all", "All"],
            ["missed", "Missed"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`chip ${filter === id ? "chip-active" : ""}`} onClick={() => setFilter(id)} aria-pressed={filter === id}>
              {label}
            </button>
          ))}
        </div>
      </PanelHeader>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-28 md:pb-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) useCallLogStore.getState().loadMore();
        }}
      >
        {!loaded ? (
          <ConversationSkeleton rows={6} />
        ) : shown.length === 0 ? (
          <div className="anim-fade mx-auto max-w-xs px-4 py-14 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-base-200 text-base-content/45">
              <Phone className="size-6" />
            </span>
            <p className="font-semibold">{filter === "missed" ? "No missed calls" : "No calls yet"}</p>
            <p className="mt-1 text-sm text-base-content/55">Voice and video calls with your contacts show up here.</p>
            <button type="button" className="btn btn-primary btn-sm mt-4 rounded-xl" onClick={() => setNewCall(true)}>
              Start a call
            </button>
          </div>
        ) : (
          shown.map((call, i) => (
            <div key={call.message._id}>
              {(i === 0 || !isSameDay(shown[i - 1].message.createdAt, call.message.createdAt)) && (
                <div className="px-2 pb-1 pt-3 text-[0.8125rem] font-semibold text-base-content/55">{formatDayLabel(call.message.createdAt)}</div>
              )}
              <CallRow call={call} index={i} onOpen={() => open(call)} />
            </div>
          ))
        )}
        {loadingMore && <ConversationSkeleton rows={2} />}
        {!hasMore && shown.length > 8 && <p className="py-4 text-center text-xs text-base-content/40">That's everything</p>}
      </div>

      {!wide && (
        <button
          type="button"
          onClick={() => setNewCall(true)}
          className="anim-pop absolute bottom-4 right-4 z-10 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-content shadow-float transition active:scale-95"
          aria-label="New call"
        >
          <PhoneCall className="size-6" />
        </button>
      )}
      <NewCallSheet open={newCall} onClose={() => setNewCall(false)} />
    </div>
  );
}

export default function CallsPage() {
  return (
    <SplitView
      list={<CallsList />}
      detail={
        <DetailPlaceholder icon={Phone} title="Crystal-clear calls" body="Start a voice or video call from any chat, or pick someone with the new call button. Calls are peer-to-peer and encrypted in transit." />
      }
    />
  );
}
