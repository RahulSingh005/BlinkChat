import { lazy, Suspense, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  BarChart3,
  CalendarClock,
  Camera,
  Contact,
  FileText,
  Image as ImageIcon,
  Languages,
  MapPin,
  Mic,
  Moon,
  Pencil,
  Plus,
  SendHorizontal,
  Siren,
  Smile,
  Sparkles,
  Sunrise,
  Target,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import Menu from "../ui/Menu";
import Spinner from "../ui/Spinner";
import VoiceRecorder from "./VoiceRecorder";
import { ContactSheet, LocationSheet, PollSheet } from "./ComposerSheets";
import { useLongPress } from "../../hooks/useLongPress";
import { useIsWide } from "../../hooks/useMediaQuery";
import { useNow } from "../../hooks/useNow";
import { api, errorMessage } from "../../lib/api";
import { getDraft, setDraft } from "../../lib/drafts";
import { firstName, formatUntil, formatWhen } from "../../lib/format";
import { clientId } from "../../lib/ids";
import { canRecordVoice, kindOf, prepareImage, videoMeta } from "../../lib/media";
import { isTouchDevice } from "../../lib/platform";
import { previewText } from "../../lib/preview";
import { sounds } from "../../lib/sound";
import { differentZone, isNightIn, isValidTz, myTimezone, nextWallTime, timeIn } from "../../lib/time";
import { useAuthStore } from "../../store/useAuthStore";
import { peerOf, useChatStore } from "../../store/useChatStore";
import { useAiEnabled, useConfigStore } from "../../store/useConfigStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUIStore } from "../../store/useUIStore";

const MediaPicker = lazy(() => import("./MediaPicker"));

const MAX_FILES = 10;
const DOC_ACCEPT = ".pdf,.txt,.csv,.md,.rtf,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.pages,.numbers,.key,.epub,.zip,.rar,.7z,.tar,.gz";
const TRANSLATE_TO = [
  ["en", "English"],
  ["hi", "Hindi"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["ar", "Arabic"],
  ["pt", "Portuguese"],
  ["ja", "Japanese"],
];
const REWRITES = [
  ["fix", "Fix spelling & grammar"],
  ["friendly", "Make it friendlier"],
  ["professional", "More professional"],
  ["concise", "Make it shorter"],
  ["emoji", "Add emojis"],
];
// "@" followed by a partial name right before the caret.
const MENTION_RE = /(^|\s)@([\p{L}\p{N}_.-]{0,30})$/u;

function Banner({ icon: Icon, tone = "neutral", children, onClose }) {
  const tones = { neutral: "bg-base-200/80", night: "bg-indigo-500/10 text-indigo-900 dark:text-indigo-100", focus: "bg-warning/10" };
  return (
    <div className={`anim-slide-up mb-2 flex items-center gap-2.5 rounded-2xl px-3 py-2 text-[0.8125rem] ${tones[tone]}`}>
      <Icon className="size-4 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="icon-btn icon-btn-sm size-7" aria-label="Dismiss">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export default function Composer({ conv, ref }) {
  const me = useAuthStore((s) => s.authUser);
  const peer = peerOf(conv, me._id);
  const peerOnline = useAuthStore((s) => Boolean(peer && s.presence[peer._id]?.online));
  const replyTo = useChatStore((s) => s.replyTo[conv._id]);
  const editing = useChatStore((s) => s.editing[conv._id]);
  const hasNewer = useChatStore((s) => Boolean(s.threads[conv._id]?.hasNewer));
  const enterToSend = useSettingsStore((s) => s.enterToSend);
  const soundsOn = useSettingsStore((s) => s.sounds);
  const smartOn = useSettingsStore((s) => s.smartReplies);
  const ai = useAiEnabled();
  const limits = useConfigStore((s) => s.config?.limits);
  const wide = useIsWide();
  useNow(60000);

  const [text, setText] = useState(() => getDraft(conv._id));
  const [files, setFiles] = useState([]);
  const [viewOnce, setViewOnce] = useState(false);
  const [recording, setRecording] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [nudgeHidden, setNudgeHidden] = useState(false);
  const [menu, setMenu] = useState(null); // { type, anchor }
  const [sheet, setSheet] = useState(null); // poll | location | contact
  const [aiBusy, setAiBusy] = useState(false);
  const [undo, setUndo] = useState(null);
  const [smart, setSmart] = useState({ status: "idle", replies: [], forId: null });
  const [mention, setMention] = useState(null); // { query, start, index }
  const mentionIds = useRef(new Map()); // userId -> first name inserted
  const textareaRef = useRef(null);
  const photoInput = useRef(null);
  const cameraInput = useRef(null);
  const docInput = useRef(null);
  const typingState = useRef({ last: 0, timer: 0, active: false });
  const undoTimer = useRef(0);

  const chat = useChatStore.getState();
  const blocked = conv.blocked;
  const peerGone = conv.type === "direct" && (!peer || peer.deleted);
  const isGroup = conv.type === "group";
  const isSelf = conv.type === "self";

  const focus = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, []);

  // ---- typing indicator -----------------------------------------------------
  const emitTyping = useCallback(
    (payload) => {
      if (isSelf) return;
      useAuthStore.getState().socket?.emit("typing", { conversationId: conv._id, ...payload });
    },
    [conv._id, isSelf]
  );
  const stopTyping = useCallback(() => {
    const s = typingState.current;
    clearTimeout(s.timer);
    if (s.active) emitTyping({ isTyping: false });
    s.active = false;
    s.last = 0;
  }, [emitTyping]);
  const pingTyping = useCallback(() => {
    const s = typingState.current;
    const now = Date.now();
    if (now - s.last > 2500) {
      emitTyping({ isTyping: true });
      s.last = now;
    }
    s.active = true;
    clearTimeout(s.timer);
    s.timer = setTimeout(stopTyping, 4000);
  }, [emitTyping, stopTyping]);
  useEffect(() => stopTyping, [stopTyping]);

  // ---- edit / reply / drafts --------------------------------------------------
  const editingId = editing?._id;
  useEffect(() => {
    if (!editingId) return;
    setText(useChatStore.getState().editing[conv._id]?.text || "");
    requestAnimationFrame(focus);
  }, [editingId, conv._id, focus]);

  const replyId = replyTo?._id;
  useEffect(() => {
    if (replyId) requestAnimationFrame(focus);
  }, [replyId, focus]);

  useEffect(() => {
    if (!editing) setDraft(conv._id, text);
  }, [text, editing, conv._id]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text, recording]);

  // Focus the input when a chat opens on larger screens.
  useEffect(() => {
    if (!isTouchDevice()) focus();
  }, [focus]);

  // ---- @mentions (groups) ---------------------------------------------------------
  const candidates = useMemo(() => {
    if (!mention || !isGroup) return [];
    const q = mention.query.toLowerCase();
    return conv.members
      .filter((m) => m.user._id !== me._id && !m.user.deleted)
      .filter((m) => !q || m.user.fullName.toLowerCase().split(/\s+/).some((part) => part.startsWith(q)) || m.user.fullName.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [mention, isGroup, conv.members, me._id]);

  const detectMention = (value, caret) => {
    if (!isGroup) return;
    const before = value.slice(0, caret);
    const match = MENTION_RE.exec(before);
    if (match) setMention({ query: match[2], start: caret - match[2].length - 1, index: 0 });
    else if (mention) setMention(null);
  };

  const pickMention = (member) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const name = firstName(member.user.fullName);
    const next = `${text.slice(0, mention.start)}@${name} ${text.slice(caret)}`;
    mentionIds.current.set(member.user._id, name);
    setText(next);
    setMention(null);
    const pos = mention.start + name.length + 2;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const currentMentions = (value) =>
    [...mentionIds.current.entries()].filter(([, name]) => new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(value)).map(([id]) => id);

  // ---- attachments -------------------------------------------------------------
  const addFiles = useCallback(
    async (list) => {
      const room = MAX_FILES - files.length;
      const incoming = [...list].slice(0, Math.max(0, room));
      if (list.length > room) toast(`You can attach up to ${MAX_FILES} files at once`);
      for (const raw of incoming) {
        const kind = kindOf(raw);
        try {
          let prepared = { file: raw };
          if (kind === "image") prepared = await prepareImage(raw);
          else if (kind === "video") prepared = { file: raw, ...(await videoMeta(raw)) };
          const limit = limits?.uploadBytes?.[kind] ?? 10 * 1024 * 1024;
          if (prepared.file.size > limit) {
            toast.error(`“${raw.name}” is too large (max ${Math.round(limit / 1048576)} MB)`);
            continue;
          }
          const previewUrl = kind === "file" ? null : URL.createObjectURL(prepared.file);
          setFiles((prev) => (prev.length >= MAX_FILES ? prev : [...prev, { id: clientId(), kind, previewUrl, ...prepared }]));
        } catch {
          toast.error(`Couldn't add “${raw.name}”`);
        }
      }
    },
    [files.length, limits]
  );

  const removeFile = (id) =>
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });

  useImperativeHandle(ref, () => ({ addFiles, focus }), [addFiles, focus]);

  const singleMedia = files.length === 1 && (files[0].kind === "image" || files[0].kind === "video");
  useEffect(() => {
    if (!singleMedia) setViewOnce(false);
  }, [singleMedia]);

  // ---- sending ---------------------------------------------------------------
  const reset = () => {
    setText("");
    setDraft(conv._id, "");
    setFiles([]);
    setViewOnce(false);
    setUrgent(false);
    setUndo(null);
    setMention(null);
    mentionIds.current.clear();
    chat.setReplyTo(conv._id, null);
    stopTyping();
  };

  const afterSend = () => {
    if (soundsOn) sounds.sent();
    if (!isTouchDevice()) focus();
  };

  const send = async ({ sendAt, forceUrgent } = {}) => {
    const value = text.trim();
    if (editing) {
      if (!value) return;
      try {
        if (value !== editing.text) await chat.editMessage(conv._id, editing._id, value);
        chat.setEditing(conv._id, null);
        setText(getDraft(conv._id));
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't edit"));
      }
      return;
    }
    if (!value && !files.length) return;
    if (blocked || peerGone) return;

    if (sendAt) {
      if (files.length) return toast("Scheduling works for text messages. Remove attachments to schedule.");
      try {
        await chat.schedule(conv._id, { text: value, replyTo, urgent: forceUrgent ?? urgent, sendAt });
        toast.success(`Scheduled · ${formatWhen(sendAt)}`);
        reset();
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't schedule"));
      }
      return;
    }

    if (hasNewer) await chat.jumpToLatest(conv._id);
    const sending = files;
    chat.sendMessage(conv._id, {
      text: value,
      files: sending,
      replyTo,
      urgent: forceUrgent ?? urgent,
      mentions: isGroup ? currentMentions(value) : [],
      viewOnce: viewOnce && singleMedia,
    });
    reset();
    // Local previews stay valid long enough for the bubbles to swap to the CDN copy.
    setTimeout(() => sending.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl)), 3 * 60 * 1000);
    afterSend();
  };

  /** GIFs, stickers, polls, locations and contacts go out right away. */
  const sendSpecial = async (payload) => {
    if (blocked || peerGone) return;
    if (hasNewer) await chat.jumpToLatest(conv._id);
    chat.sendMessage(conv._id, { replyTo: useChatStore.getState().replyTo[conv._id], ...payload });
    chat.setReplyTo(conv._id, null);
    afterSend();
  };

  const onVoiceDone = useCallback(
    (voice) => {
      setRecording(false);
      emitTyping({ isTyping: false, recording: true });
      chat.sendMessage(conv._id, { text: "", files: [{ id: clientId(), ...voice }], replyTo: useChatStore.getState().replyTo[conv._id] });
      chat.setReplyTo(conv._id, null);
      if (useSettingsStore.getState().sounds) sounds.sent();
    },
    [chat, conv._id, emitTyping]
  );
  const onVoiceCancel = useCallback(() => {
    setRecording(false);
    emitTyping({ isTyping: false, recording: true });
  }, [emitTyping]);
  const onRecordingPing = useCallback(() => emitTyping({ isTyping: true, recording: true }), [emitTyping]);

  const lastOwnEditable = () => {
    const items = useChatStore.getState().threads[conv._id]?.items || [];
    const windowMs = limits?.editWindowMs || 24 * 3600 * 1000;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const m = items[i];
      if (m.sender === me._id && m.type === "user" && m.text && !m.deletedAt && !m.status && !m.forwarded && !m.poll) {
        return Date.now() - new Date(m.createdAt).getTime() < windowMs ? m : null;
      }
    }
    return null;
  };

  const onKeyDown = (e) => {
    if (mention && candidates.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setMention((m) => ({ ...m, index: (m.index + delta + candidates.length) % candidates.length }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(candidates[mention.index] || candidates[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && (enterToSend || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") {
      if (editing) {
        e.preventDefault();
        chat.setEditing(conv._id, null);
        setText(getDraft(conv._id));
      } else if (replyTo) {
        e.preventDefault();
        chat.setReplyTo(conv._id, null);
      }
    } else if (e.key === "ArrowUp" && !text && !editing) {
      const last = lastOwnEditable();
      if (last) {
        e.preventDefault();
        chat.setEditing(conv._id, last);
      }
    }
  };

  const onPaste = (e) => {
    const pasted = [...(e.clipboardData?.files || [])];
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  const insertAtCursor = (str) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + str + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(start + str.length, start + str.length);
    });
  };

  // ---- AI helpers --------------------------------------------------------------
  const applyAi = async (request) => {
    const original = text;
    setAiBusy(true);
    try {
      const out = await request(original);
      setText(out);
      setUndo(original);
      clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 9000);
    } catch (err) {
      toast.error(errorMessage(err, "AI couldn't help with that right now"));
    } finally {
      setAiBusy(false);
    }
  };
  const rewrite = (style) => applyAi(async (t) => (await api.post("/ai/rewrite", { text: t, style, conversationId: conv._id })).data.text);
  const translateDraft = (lang) => applyAi(async (t) => (await api.post("/ai/translate", { text: t, lang })).data.text);

  const last = conv.lastMessage;
  const smartEligible =
    ai && smartOn && !isSelf && last && last.type === "user" && last.sender !== me._id && !last.deletedAt && !text && !files.length && !editing && !recording && !blocked;
  const smartState = smart.forId === last?._id ? smart : { status: "idle", replies: [] };
  const fetchSmart = async () => {
    setSmart({ status: "loading", replies: [], forId: last._id });
    try {
      const res = await api.post("/ai/smart-replies", { conversationId: conv._id });
      setSmart({ status: "done", replies: res.data.replies, forId: last._id });
    } catch (err) {
      toast.error(errorMessage(err, "No suggestions right now"));
      setSmart({ status: "idle", replies: [], forId: null });
    }
  };

  // ---- context banners -------------------------------------------------------
  const tz = peer?.timezone;
  const tzKnown = conv.type === "direct" && isValidTz(tz);
  const theirMorning = tzKnown ? nextWallTime(tz, 9, 0) : null;
  const showNudge = tzKnown && !peerOnline && isNightIn(tz) && text.trim() && !editing && !nudgeHidden;
  const focusing = conv.type === "direct" && peer?.focusUntil && new Date(peer.focusUntil) > new Date();

  const hasContent = Boolean(text.trim() || files.length || editing);
  const longPressSend = useLongPress((e, target) => hasContent && !editing && setMenu({ type: "send", anchor: target }));
  const pad = "px-[clamp(10px,4.5cqw,80px)]";

  if (blocked || peerGone) {
    return (
      <div className="safe-bottom shrink-0 border-t border-base-300/70 bg-base-100 px-4 py-3">
        <div className="flex items-center justify-center gap-3 text-sm text-base-content/60">
          {peerGone ? (
            "This account was deleted. You can't reply to this chat."
          ) : (
            <>
              You blocked {firstName(peer?.fullName)}.
              <button
                type="button"
                className="btn btn-sm rounded-xl"
                onClick={() =>
                  chat
                    .toggleBlock(peer._id)
                    .then(() => toast.success("Unblocked"))
                    .catch((err) => toast.error(errorMessage(err)))
                }
              >
                Unblock
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const replyName = replyTo ? (replyTo.sender === me._id ? "yourself" : firstName(conv.members.find((m) => m.user._id === replyTo.sender)?.user.fullName)) : "";

  return (
    <div className={`safe-bottom relative shrink-0 border-t border-base-300/70 bg-base-100 pb-2 pt-2 md:pb-3 ${pad}`}>
      {focusing && !editing && (
        <Banner icon={Target} tone="focus">
          <span className="font-medium">
            {firstName(peer.fullName)} is focusing {formatUntil(peer.focusUntil)}.
          </span>{" "}
          <span className="text-base-content/60">They'll be notified later.</span>
          {peer.allowUrgent && (
            <button
              type="button"
              onClick={() => setUrgent((u) => !u)}
              className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition ${urgent ? "bg-error text-error-content" : "bg-base-content/10"}`}
              aria-pressed={urgent}
            >
              <Siren className="size-3" /> {urgent ? "Urgent" : "Notify anyway"}
            </button>
          )}
        </Banner>
      )}

      {showNudge && (
        <Banner icon={Moon} tone="night" onClose={() => setNudgeHidden(true)}>
          It's {timeIn(tz)} for {firstName(peer.fullName)}.{" "}
          <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => send({ sendAt: theirMorning })}>
            Send at 9:00 AM their time
          </button>
        </Banner>
      )}

      {(replyTo || editing) && (
        <div className="anim-slide-up mb-2 flex items-center gap-3 rounded-2xl bg-base-200/80 py-2 pl-3 pr-1.5">
          <span className="w-[3px] self-stretch rounded-full bg-primary" />
          {editing ? <Pencil className="size-4 shrink-0 text-primary" /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">{editing ? "Edit message" : `Replying to ${replyName}`}</p>
            <p className="truncate text-[0.85rem] text-base-content/60">{previewText(editing || replyTo, { conv, meId: me._id })}</p>
          </div>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => {
              if (editing) {
                chat.setEditing(conv._id, null);
                setText(getDraft(conv._id));
              } else chat.setReplyTo(conv._id, null);
            }}
            aria-label={editing ? "Cancel editing" : "Cancel reply"}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="anim-slide-up mb-2 flex items-end gap-2">
          <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 pt-1.5">
            {files.map((f) => (
              <div key={f.id} className="relative shrink-0">
                {f.kind === "image" || f.kind === "video" ? (
                  f.kind === "image" ? (
                    <img src={f.previewUrl} alt="" className="size-16 rounded-xl border border-base-300 object-cover" />
                  ) : (
                    <video src={f.previewUrl} muted className="size-16 rounded-xl border border-base-300 object-cover" />
                  )
                ) : (
                  <div className="flex h-16 w-40 items-center gap-2 rounded-xl border border-base-300 bg-base-200/60 px-2.5">
                    <FileText className="size-5 shrink-0 text-primary" />
                    <span className="line-clamp-2 text-xs font-medium">{f.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-neutral text-neutral-content shadow ring-2 ring-base-100"
                  aria-label={`Remove ${f.file.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          {singleMedia && !isSelf && (
            <button
              type="button"
              onClick={() => setViewOnce((v) => !v)}
              aria-pressed={viewOnce}
              title="View once: it can be opened a single time"
              className={`mb-1 flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
                viewOnce ? "border-primary bg-primary text-primary-content" : "border-base-300 text-base-content/70 hover:bg-base-200"
              }`}
            >
              <span className={`flex size-5 items-center justify-center rounded-full border-[1.5px] text-[10px] font-bold ${viewOnce ? "border-primary-content" : "border-current border-dashed"}`}>1</span>
              View once
            </button>
          )}
        </div>
      )}

      {smartEligible && (
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
          {smartState.status === "idle" && (
            <button type="button" onClick={fetchSmart} className="chip anim-fade gap-1.5">
              <Sparkles className="size-3.5 text-accent" /> Suggest replies
            </button>
          )}
          {smartState.status === "loading" && [96, 132, 84].map((w, i) => <span key={i} className="skeleton-line h-8 shrink-0 rounded-full" style={{ width: w }} />)}
          {smartState.status === "done" &&
            smartState.replies.map((r, i) => (
              <button
                key={r}
                type="button"
                className="chip anim-cascade border border-base-300/80 bg-base-100"
                style={{ "--i": i * 2 }}
                onClick={() => {
                  setText(r);
                  pingTyping();
                  requestAnimationFrame(focus);
                }}
              >
                {r}
              </button>
            ))}
        </div>
      )}

      {undo !== null && (
        <div className="anim-fade mb-2 flex items-center gap-2 text-xs text-base-content/55">
          <WandSparkles className="size-3.5 text-accent" /> Rewritten with AI
          <button
            type="button"
            className="inline-flex items-center gap-1 font-semibold text-primary"
            onClick={() => {
              setText(undo);
              setUndo(null);
            }}
          >
            <Undo2 className="size-3.5" /> Undo
          </button>
        </div>
      )}

      {/* @mention suggestions */}
      {mention && candidates.length > 0 && (
        <div className={`anim-slide-up absolute bottom-full left-0 right-0 z-20 mb-1 ${pad}`}>
          <ul className="max-w-sm overflow-hidden rounded-2xl border border-base-300/80 bg-base-100 p-1 shadow-float" role="listbox" aria-label="Mention someone">
            {candidates.map((m, i) => (
              <li key={m.user._id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === mention.index}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickMention(m)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${i === mention.index ? "bg-base-content/[0.07]" : "hover:bg-base-content/[0.04]"}`}
                >
                  <Avatar src={m.user.profilePic} name={m.user.fullName} seed={m.user._id} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.user.fullName}</span>
                  {m.role === "admin" && <span className="text-[10px] font-semibold uppercase text-base-content/45">Admin</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {recording ? (
          <div className="min-w-0 flex-1">
            <VoiceRecorder onCancel={onVoiceCancel} onDone={onVoiceDone} onRecordingPing={onRecordingPing} />
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`icon-btn mb-1 transition-transform ${menu?.type === "attach" ? "rotate-45" : ""}`}
              onClick={(e) => setMenu({ type: "attach", anchor: e.currentTarget })}
              aria-label="Attach"
              title="Attach"
              disabled={Boolean(editing)}
            >
              <Plus className="size-6" />
            </button>

            <div
              className={`flex min-w-0 flex-1 items-end rounded-[24px] bg-base-200 transition focus-within:ring-2 focus-within:ring-primary/25 ${urgent ? "ring-2 ring-error/40" : ""}`}
            >
              <button type="button" className="icon-btn mb-1 ml-1" onClick={(e) => setMenu({ type: "emoji", anchor: e.currentTarget })} aria-label="Emoji, GIFs and stickers" title="Emoji & GIFs">
                <Smile className="size-[22px]" />
              </button>
              <textarea
                ref={textareaRef}
                rows={1}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  detectMention(e.target.value, e.target.selectionStart);
                  if (e.target.value.trim()) pingTyping();
                  else stopTyping();
                }}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={() => {
                  stopTyping();
                  setTimeout(() => setMention(null), 150);
                }}
                onClick={(e) => detectMention(e.currentTarget.value, e.currentTarget.selectionStart)}
                placeholder={editing ? "Edit your message" : isGroup ? `Message ${conv.name}` : isSelf ? "Write a note" : "Message"}
                enterKeyHint={enterToSend ? "send" : "enter"}
                aria-label="Message"
                className="max-h-[180px] min-h-12 min-w-0 flex-1 resize-none bg-transparent py-3 pl-1 pr-2 text-[0.95rem] leading-6 outline-none placeholder:text-base-content/45"
              />
              {ai && text.trim() && !editing && (
                <button
                  type="button"
                  className="icon-btn mb-1 mr-1 text-accent"
                  onClick={(e) => setMenu({ type: "ai", anchor: e.currentTarget })}
                  aria-label="Improve with AI"
                  title="Rewrite or translate"
                  disabled={aiBusy}
                >
                  {aiBusy ? <Spinner className="size-[18px]" /> : <WandSparkles className="size-[19px]" />}
                </button>
              )}
              {!text.trim() && !files.length && isTouchDevice() && !editing && (
                <button type="button" className="icon-btn mb-1 mr-1" onClick={() => cameraInput.current?.click()} aria-label="Camera">
                  <Camera className="size-[21px]" />
                </button>
              )}
            </div>

            {hasContent || !canRecordVoice() ? (
              <button
                key="send"
                type="button"
                {...longPressSend}
                onClick={() => send()}
                onContextMenu={(e) => {
                  if (!hasContent || editing) return;
                  e.preventDefault();
                  setMenu({ type: "send", anchor: e.currentTarget });
                }}
                disabled={!hasContent}
                className={`anim-scale-in flex size-12 shrink-0 items-center justify-center rounded-full shadow-soft transition active:scale-95 disabled:opacity-50 ${
                  urgent ? "bg-error text-error-content" : "bg-primary text-primary-content"
                }`}
                aria-label={editing ? "Save edit" : "Send"}
                title={wide && !editing ? "Send · right-click for options" : undefined}
              >
                {editing ? <Pencil className="size-5" /> : <SendHorizontal className="size-5" />}
              </button>
            ) : (
              <button
                key="mic"
                type="button"
                onClick={() => setRecording(true)}
                className="anim-scale-in flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-content shadow-soft transition active:scale-95"
                aria-label="Record voice message"
                title="Voice message"
              >
                <Mic className="size-5" />
              </button>
            )}
          </>
        )}
      </div>

      <input ref={photoInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
      <input ref={docInput} type="file" accept={DOC_ACCEPT} multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />

      <Menu
        open={menu?.type === "attach"}
        anchor={menu?.anchor}
        onClose={() => setMenu(null)}
        title="Share"
        width={250}
        items={[
          { key: "media", label: "Photos & videos", icon: ImageIcon, onSelect: () => photoInput.current?.click() },
          isTouchDevice() && { key: "camera", label: "Camera", icon: Camera, onSelect: () => cameraInput.current?.click() },
          { key: "doc", label: "Document", icon: FileText, onSelect: () => docInput.current?.click() },
          { key: "poll", label: "Poll", icon: BarChart3, onSelect: () => setSheet("poll") },
          { key: "location", label: "Location", icon: MapPin, onSelect: () => setSheet("location") },
          { key: "contact", label: "Contact", icon: Contact, onSelect: () => setSheet("contact") },
          "divider",
          {
            key: "schedule",
            label: "Schedule a message",
            icon: CalendarClock,
            onSelect: () =>
              text.trim()
                ? useUIStore.getState().open("schedule", { conv, onPick: (date) => send({ sendAt: date }) })
                : toast("Type a message first, then schedule it"),
          },
        ]}
      />
      <Menu
        open={menu?.type === "send"}
        anchor={menu?.anchor}
        onClose={() => setMenu(null)}
        title="Send options"
        items={[
          { key: "schedule", label: "Schedule message…", icon: CalendarClock, onSelect: () => useUIStore.getState().open("schedule", { conv, onPick: (date) => send({ sendAt: date }) }) },
          tzKnown &&
            differentZone(tz, myTimezone()) && {
              key: "morning",
              label: "Send at their morning",
              hint: formatWhen(theirMorning),
              icon: Sunrise,
              onSelect: () => send({ sendAt: theirMorning }),
            },
          focusing && peer.allowUrgent && { key: "urgent", label: "Send as urgent", icon: Siren, onSelect: () => send({ forceUrgent: true }) },
        ]}
      />
      <Menu
        open={menu?.type === "ai"}
        anchor={menu?.anchor}
        onClose={() => setMenu(null)}
        title="Improve with AI"
        width={250}
        items={[
          ...REWRITES.map(([style, label]) => ({ key: style, label, icon: WandSparkles, onSelect: () => rewrite(style) })),
          { section: "Translate to" },
          ...TRANSLATE_TO.map(([code, label]) => ({
            key: `tr-${code}`,
            label,
            icon: Languages,
            onSelect: () => translateDraft(code),
          })),
        ]}
      />
      {menu?.type === "emoji" && (
        <Suspense fallback={null}>
          <MediaPicker
            anchor={menu.anchor}
            onClose={() => setMenu(null)}
            onEmoji={insertAtCursor}
            onGif={(item) => sendSpecial({ attachments: [item.attachment] })}
            keepOpen={wide}
          />
        </Suspense>
      )}

      <PollSheet open={sheet === "poll"} onClose={() => setSheet(null)} onSubmit={(poll) => sendSpecial({ poll })} />
      <LocationSheet open={sheet === "location"} onClose={() => setSheet(null)} onSubmit={(location) => sendSpecial({ location })} />
      <ContactSheet open={sheet === "contact"} onClose={() => setSheet(null)} onSubmit={(contact) => sendSpecial({ contact })} />
    </div>
  );
}
