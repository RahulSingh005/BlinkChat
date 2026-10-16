import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Camera, ChevronLeft, ChevronRight, Download, Search, Users, X } from "lucide-react";
import Avatar from "../ui/Avatar";
import Sheet from "../ui/Sheet";
import Spinner from "../ui/Spinner";
import PeoplePicker from "./PeoplePicker";
import TimePickerSheet from "./TimePickerSheet";
import { useIsWide } from "../../hooks/useMediaQuery";
import { errorMessage, mediaUrl } from "../../lib/api";
import { firstName, formatDateTime, formatWhen } from "../../lib/format";
import { cropSquare } from "../../lib/media";
import { previewText } from "../../lib/preview";
import { setNavDirection } from "../../lib/transitions";
import { uploadFile } from "../../lib/upload";
import { useAuthStore } from "../../store/useAuthStore";
import { conversationTitle, peerOf, useChatStore } from "../../store/useChatStore";
import { useReminderStore } from "../../store/useReminderStore";
import { useUIStore } from "../../store/useUIStore";

function useGo() {
  const navigate = useNavigate();
  const wide = useIsWide();
  return (id) => {
    if (!wide) setNavDirection("forward");
    navigate(`/chat/${id}`, { viewTransition: true });
  };
}

function NewChatDialog() {
  const open = useUIStore((s) => s.newChatOpen);
  const close = () => useUIStore.getState().close("newChatOpen");
  const go = useGo();

  const pick = async (user) => {
    try {
      const conv = await useChatStore.getState().openDirect(user._id);
      close();
      go(conv._id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Sheet open={open} onClose={close} title="New chat" size="md" tall>
      <button
        type="button"
        onClick={() => {
          close();
          useUIStore.getState().open("newGroupOpen");
        }}
        className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-base-200/60 px-3 py-2.5 text-left transition hover:bg-base-200"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-content">
          <Users className="size-5" />
        </span>
        <span>
          <span className="block font-medium">New group</span>
          <span className="block text-xs text-base-content/55">Chat with up to 256 people</span>
        </span>
      </button>
      <PeoplePicker onPick={pick} />
    </Sheet>
  );
}

function NewGroupDialog() {
  const open = useUIStore((s) => s.newGroupOpen);
  const close = () => useUIStore.getState().close("newGroupOpen");
  const go = useGo();
  const [step, setStep] = useState(1);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setMembers([]);
      setName("");
      setPhoto(null);
    }
  }, [open]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      let avatar = "";
      if (photo) avatar = (await uploadFile(photo.file, { purpose: "group" })).url;
      const conv = await useChatStore.getState().createGroup({ name: name.trim(), memberIds: members.map((m) => m._id), avatar });
      close();
      go(conv._id);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create the group"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={step === 1 ? "Add members" : "Name your group"}
      description={step === 1 ? `${members.length} selected` : `${members.length + 1} members including you`}
      size="md"
      tall={step === 1}
      footer={
        step === 1 ? (
          <button type="button" className="btn btn-primary h-11 min-h-0 w-full rounded-xl" disabled={!members.length} onClick={() => setStep(2)}>
            Next
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost h-11 min-h-0 rounded-xl" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn btn-primary h-11 min-h-0 flex-1 rounded-xl" disabled={!name.trim() || busy} onClick={create}>
              {busy ? <Spinner className="size-4" /> : "Create group"}
            </button>
          </div>
        )
      }
    >
      {step === 1 ? (
        <PeoplePicker multiple selected={members} onChange={setMembers} />
      ) : (
        <div className="anim-fade flex flex-col items-center gap-5 py-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex size-24 items-center justify-center overflow-hidden rounded-full bg-base-200 text-base-content/50 transition hover:bg-base-300"
            aria-label="Add group photo"
          >
            {photo ? <img src={photo.preview} alt="" className="size-full object-cover" /> : <Camera className="size-7" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const cropped = await cropSquare(f);
                setPhoto({ file: cropped, preview: URL.createObjectURL(cropped) });
              } catch {
                toast.error("Couldn't use that image");
              }
            }}
          />
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Group name" className="field text-center" data-autofocus onKeyDown={(e) => e.key === "Enter" && create()} />
          <div className="flex -space-x-2">
            {members.slice(0, 8).map((m) => (
              <Avatar key={m._id} src={m.profilePic} name={m.fullName} seed={m._id} size={32} className="rounded-full ring-2 ring-base-100" />
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ForwardDialog() {
  const message = useUIStore((s) => s.forward);
  const close = () => useUIStore.getState().close("forward");
  const me = useAuthStore((s) => s.authUser);
  const conversations = useChatStore((s) => s.conversations);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!message) {
      setPicked([]);
      setQ("");
    }
  }, [message]);

  const list = useMemo(
    () =>
      Object.values(conversations)
        .filter((c) => !c.blocked && !(c.type === "direct" && peerOf(c, me._id)?.deleted))
        .filter((c) => conversationTitle(c, me._id).toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)),
    [conversations, q, me._id]
  );

  const send = async () => {
    setBusy(true);
    try {
      await useChatStore.getState().forward(message._id, picked);
      toast.success(picked.length > 1 ? `Forwarded to ${picked.length} chats` : "Forwarded");
      close();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't forward"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={Boolean(message)}
      onClose={close}
      title="Forward to…"
      description={message ? previewText(message) : ""}
      size="md"
      tall
      footer={
        <button type="button" className="btn btn-primary h-11 min-h-0 w-full rounded-xl" disabled={!picked.length || busy} onClick={send}>
          {busy ? <Spinner className="size-4" /> : `Send${picked.length ? ` to ${picked.length}` : ""}`}
        </button>
      }
    >
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-base-content/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="field pl-10" data-autofocus />
      </div>
      <ul className="-mx-2">
        {list.map((c) => {
          const peer = peerOf(c, me._id);
          const on = picked.includes(c._id);
          return (
            <li key={c._id}>
              <button
                type="button"
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c._id) : p.length >= 5 ? (toast("Up to 5 chats at once"), p) : [...p, c._id]))}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-base-content/[0.05]"
              >
                <Avatar src={c.type === "group" ? c.avatar : peer?.profilePic} name={conversationTitle(c, me._id)} seed={c.type === "group" ? c._id : peer?._id} group={c.type === "group"} size={42} />
                <span className="min-w-0 flex-1 truncate font-medium">{conversationTitle(c, me._id)}</span>
                <span className={`flex size-6 items-center justify-center rounded-full border-2 transition ${on ? "border-primary bg-primary text-primary-content" : "border-base-300"}`}>
                  {on && <span className="size-2 rounded-full bg-primary-content" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function RemindDialog() {
  const message = useUIStore((s) => s.remind);
  const close = () => useUIStore.getState().close("remind");
  return (
    <TimePickerSheet
      open={Boolean(message)}
      onClose={close}
      title="Remind me"
      description={message ? previewText(message) : ""}
      reminder
      withNote
      submitLabel="Set"
      onPick={async (date, note) => {
        try {
          await useReminderStore.getState().create(message._id, date, note);
          toast.success(`Reminder set · ${formatWhen(date)}`);
        } catch (err) {
          toast.error(errorMessage(err, "Couldn't set the reminder"));
        }
      }}
    />
  );
}

function ScheduleDialog() {
  const state = useUIStore((s) => s.schedule);
  const me = useAuthStore((s) => s.authUser);
  const close = () => useUIStore.getState().close("schedule");
  const peer = state?.conv ? peerOf(state.conv, me._id) : null;
  return (
    <TimePickerSheet
      open={Boolean(state)}
      onClose={close}
      title="Schedule message"
      description="It will be sent automatically, even if you're offline."
      theirTimezone={peer?.timezone}
      theirName={peer ? firstName(peer.fullName) : ""}
      onPick={(date) => state?.onPick(date)}
    />
  );
}

/** Full-screen photo/video viewer with keyboard + swipe navigation. */
function Lightbox() {
  const state = useUIStore((s) => s.lightbox);
  const [index, setIndex] = useState(0);
  const touch = useRef(null);
  const close = () => useUIStore.getState().close("lightbox");

  useEffect(() => {
    if (state) setIndex(state.index || 0);
  }, [state]);

  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(state.items.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;
  const item = state.items[index];
  if (!item) return null;
  const src = item.previewUrl || mediaUrl(item.url);
  const count = state.items.length;

  return (
    <div
      className="anim-fade fixed inset-0 z-[95] flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        if (!touch.current) return;
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) close();
        else if (dx < -50) setIndex((i) => Math.min(count - 1, i + 1));
        else if (dx > 50) setIndex((i) => Math.max(0, i - 1));
        touch.current = null;
      }}
    >
      <div className="safe-top flex items-center gap-3 px-3 py-2">
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-sm font-medium">{item.sender}</p>
          <p className="text-xs text-white/60">{formatDateTime(item.at)}</p>
        </div>
        {!item.local && (
          <a href={mediaUrl(item.url)} download target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-full hover:bg-white/10" aria-label="Download">
            <Download className="size-5" />
          </a>
        )}
        <button type="button" onClick={close} className="flex size-10 items-center justify-center rounded-full hover:bg-white/10" aria-label="Close">
          <X className="size-6" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2" onClick={(e) => e.target === e.currentTarget && close()}>
        {item.kind === "video" ? (
          <video key={src} src={src} controls autoPlay playsInline className="anim-scale-in max-h-full max-w-full rounded-lg" />
        ) : (
          <img key={src} src={src} alt="" className="anim-scale-in max-h-full max-w-full select-none rounded-lg object-contain" draggable={false} />
        )}
        {count > 1 && (
          <>
            <button type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-0 md:flex" aria-label="Previous">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" disabled={index === count - 1} onClick={() => setIndex((i) => i + 1)} className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-0 md:flex" aria-label="Next">
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="safe-bottom flex justify-center gap-1.5 pb-4 pt-2">
          {state.items.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GlobalDialogs() {
  return (
    <>
      <NewChatDialog />
      <NewGroupDialog />
      <ForwardDialog />
      <RemindDialog />
      <ScheduleDialog />
      <Lightbox />
    </>
  );
}
