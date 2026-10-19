import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Palette, SendHorizontal, Type, X } from "lucide-react";
import { FONT_ORDER, STORY_BACKGROUNDS, STORY_FONTS, storyTextSize } from "./storyStyle";
import Spinner from "../ui/Spinner";
import { errorMessage } from "../../lib/api";
import { prepareImage, videoMeta } from "../../lib/media";
import { uploadFile } from "../../lib/upload";
import { useStoryStore } from "../../store/useStoryStore";

const MAX_VIDEO_SECONDS = 60;

/** Full-screen status composer: colorful text, or a photo/video with a caption. */
export default function StoryComposer() {
  const composer = useStoryStore((s) => s.composer);
  const close = () => useStoryStore.getState().closeComposer();
  const isMedia = composer?.kind === "media";
  const [text, setText] = useState("");
  const [bg, setBg] = useState(() => STORY_BACKGROUNDS[Math.floor(Math.random() * STORY_BACKGROUNDS.length)]);
  const [font, setFont] = useState("sans");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const textRef = useRef(null);

  const file = composer?.file;
  const isVideo = Boolean(file?.type?.startsWith("video/"));
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  useEffect(() => {
    if (!isMedia) textRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && !busy && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMedia, busy]);

  const post = async () => {
    setBusy(true);
    try {
      if (isMedia) {
        let media;
        if (isVideo) {
          const meta = await videoMeta(file);
          if (meta.duration && meta.duration > MAX_VIDEO_SECONDS + 0.5) throw new Error(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds`);
          const att = await uploadFile(file, { meta, onProgress: setProgress });
          media = { url: att.url, kind: "video", width: att.width, height: att.height, duration: att.duration ? Math.min(MAX_VIDEO_SECONDS, att.duration) : null, publicId: att.publicId, storage: att.storage };
        } else {
          const prepared = await prepareImage(file);
          const att = await uploadFile(prepared.file, { meta: { width: prepared.width, height: prepared.height }, onProgress: setProgress });
          media = { url: att.url, kind: "image", width: att.width, height: att.height, publicId: att.publicId, storage: att.storage };
        }
        await useStoryStore.getState().create({ kind: media.kind, media, caption: caption.trim() });
      } else {
        await useStoryStore.getState().create({ kind: "text", text: text.trim(), background: bg, font });
      }
      toast.success("Status shared");
      close();
    } catch (err) {
      toast.error(err.response ? errorMessage(err, "Couldn't share your status") : err.message || "Couldn't share your status");
      setBusy(false);
    }
  };

  if (!composer) return null;
  const cycleBg = () => setBg((c) => STORY_BACKGROUNDS[(STORY_BACKGROUNDS.indexOf(c) + 1) % STORY_BACKGROUNDS.length]);
  const cycleFont = () => setFont((f) => FONT_ORDER[(FONT_ORDER.indexOf(f) + 1) % FONT_ORDER.length]);
  const canPost = isMedia ? Boolean(file) : Boolean(text.trim());

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-[97] flex flex-col text-white transition-colors duration-300"
      style={{ background: isMedia ? "#000" : bg }}
      role="dialog"
      aria-modal="true"
      aria-label="New status"
    >
      <div className="safe-top flex items-center gap-2 px-3 pt-2">
        <button type="button" onClick={close} disabled={busy} className="flex size-11 items-center justify-center rounded-full hover:bg-white/10" aria-label="Discard">
          <X className="size-6" />
        </button>
        <div className="flex-1" />
        {!isMedia && (
          <>
            <button type="button" onClick={cycleFont} className="flex h-11 items-center gap-1.5 rounded-full bg-black/15 px-4 text-sm font-semibold hover:bg-black/25" aria-label="Change font">
              <Type className="size-4" /> {STORY_FONTS[font].label}
            </button>
            <button type="button" onClick={cycleBg} className="flex size-11 items-center justify-center rounded-full bg-black/15 hover:bg-black/25" aria-label="Change color">
              <Palette className="size-5" />
            </button>
          </>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-6">
        {isMedia ? (
          isVideo ? (
            <video src={preview} autoPlay loop muted playsInline className="max-h-full max-w-full rounded-2xl object-contain" />
          ) : (
            <img src={preview} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
          )
        ) : (
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 700))}
            placeholder="Type a status"
            rows={4}
            className={`w-full max-w-xl resize-none bg-transparent text-center outline-none placeholder:text-white/60 ${STORY_FONTS[font].className} ${storyTextSize(text || "Type a status")}`}
            aria-label="Status text"
          />
        )}
        {busy && isMedia && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
            <Spinner className="size-8" />
            <span className="text-sm font-medium">{progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : "Sharing…"}</span>
          </div>
        )}
      </div>

      <div className="safe-bottom flex items-end gap-2 px-3 pb-3 pt-2">
        {isMedia ? (
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={300}
            placeholder="Add a caption…"
            className="h-12 min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-4 text-[0.95rem] outline-none placeholder:text-white/60 focus:border-white/40"
          />
        ) : (
          <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
            {STORY_BACKGROUNDS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBg(c)}
                className={`size-8 shrink-0 rounded-full ring-2 transition ${bg === c ? "scale-110 ring-white" : "ring-white/30"}`}
                style={{ background: c }}
                aria-label={`Background ${c}`}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={post}
          disabled={!canPost || busy}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-float transition active:scale-95 disabled:opacity-40"
          aria-label="Share status"
        >
          {busy ? <Spinner className="size-5" /> : <SendHorizontal className="size-5" />}
        </button>
      </div>
      <p className="safe-bottom pb-2 text-center text-[11px] text-white/60">Visible to people you chat with · disappears after 24 hours</p>
    </div>,
    document.body
  );
}
