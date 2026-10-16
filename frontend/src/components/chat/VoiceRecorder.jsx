import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { SendHorizontal, Trash2 } from "lucide-react";
import { formatDuration } from "../../lib/format";

const MAX_SECONDS = 5 * 60;
const LIVE_BARS = 36;

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
};

function downsample(values, n = 48) {
  if (!values.length) return [];
  const out = [];
  const size = values.length / n;
  for (let i = 0; i < n; i += 1) {
    const slice = values.slice(Math.floor(i * size), Math.max(Math.floor(i * size) + 1, Math.floor((i + 1) * size)));
    out.push(slice.length ? Math.max(...slice) : 0);
  }
  const peak = Math.max(...out, 0.01);
  return out.map((v) => Math.round(Math.min(1, v / peak) * 100) / 100);
}

/** Inline recorder that replaces the composer row while recording. */
export default function VoiceRecorder({ onCancel, onDone, onRecordingPing }) {
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState(() => Array(LIVE_BARS).fill(0.08));
  const recorder = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const peaks = useRef([]);
  const ctx = useRef(null);
  const raf = useRef(0);
  const started = useRef(0);
  const sendOnStop = useRef(false);
  const finished = useRef(false);
  // Latest callbacks without restarting the recorder on parent re-renders.
  const cb = useRef({ onCancel, onDone, onRecordingPing });
  cb.current = { onCancel, onDone, onRecordingPing };

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    ctx.current?.close().catch(() => {});
  }, []);

  const stop = useCallback((send) => {
    if (finished.current) return;
    finished.current = true;
    sendOnStop.current = send;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    else {
      cleanup();
      if (!send) cb.current.onCancel();
    }
  }, [cleanup]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        const mime = pickMime();
        const rec = new MediaRecorder(media, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
        recorder.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.onstop = () => {
          cleanup();
          const duration = (performance.now() - started.current) / 1000;
          if (!sendOnStop.current || duration < 0.6) {
            if (sendOnStop.current) toast("Hold on a little longer to record a voice message");
            cb.current.onCancel();
            return;
          }
          const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
          const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          const blob = new Blob(chunks.current, { type });
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type });
          cb.current.onDone({
            file,
            kind: "audio",
            voice: true,
            duration: Math.round(duration * 10) / 10,
            waveform: downsample(peaks.current),
            previewUrl: URL.createObjectURL(file),
          });
        };
        rec.start(250);
        started.current = performance.now();

        // Live level meter (also stored as the message's waveform).
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          ctx.current = new AC();
          const analyser = ctx.current.createAnalyser();
          analyser.fftSize = 1024;
          ctx.current.createMediaStreamSource(media).connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          let lastSample = 0;
          const tick = (t) => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (const v of data) sum += ((v - 128) / 128) ** 2;
            const rms = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
            if (t - lastSample > 70) {
              lastSample = t;
              peaks.current.push(rms);
              setLevels((prev) => [...prev.slice(1), Math.max(0.08, rms)]);
              setElapsed((performance.now() - started.current) / 1000);
            }
            raf.current = requestAnimationFrame(tick);
          };
          raf.current = requestAnimationFrame(tick);
        }
      } catch (err) {
        toast.error(err?.name === "NotAllowedError" ? "Allow microphone access to record voice messages." : "Couldn't start recording.");
        cb.current.onCancel();
      }
    })();
    return () => {
      cancelled = true;
      finished.current = true;
      if (recorder.current && recorder.current.state !== "inactive") {
        sendOnStop.current = false;
        recorder.current.stop();
      }
      cleanup();
    };
  }, [cleanup]);

  // Timer fallback (no AudioContext) + max length + "recording…" indicator.
  useEffect(() => {
    const id = setInterval(() => {
      const secs = (performance.now() - started.current) / 1000;
      if (started.current) setElapsed(secs);
      if (secs >= MAX_SECONDS) stop(true);
    }, 500);
    const ping = setInterval(() => cb.current.onRecordingPing?.(), 2500);
    cb.current.onRecordingPing?.();
    return () => {
      clearInterval(id);
      clearInterval(ping);
    };
  }, [stop]);

  return (
    <div className="anim-fade flex items-center gap-2">
      <button type="button" onClick={() => stop(false)} className="icon-btn text-error hover:bg-error/10 hover:text-error" aria-label="Discard recording">
        <Trash2 className="size-5" />
      </button>
      <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-base-200/80 px-4">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-error/60" />
          <span className="relative size-2.5 rounded-full bg-error" />
        </span>
        <span className="w-11 shrink-0 text-sm font-medium tabular-nums">{formatDuration(elapsed)}</span>
        <div className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden="true">
          {levels.map((v, i) => (
            <span key={i} className="w-[3px] shrink-0 rounded-full bg-primary/70 transition-[height] duration-75" style={{ height: `${Math.round(v * 100)}%` }} />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => stop(true)}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-content shadow-soft transition active:scale-95"
        aria-label="Send voice message"
      >
        <SendHorizontal className="size-5" />
      </button>
    </div>
  );
}
