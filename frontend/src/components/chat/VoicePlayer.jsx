import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { mediaUrl } from "../../lib/api";
import { formatDuration } from "../../lib/format";

const BARS = 40;
const SPEEDS = [1, 1.5, 2];

// One voice note plays at a time across the whole app.
let current = null;

function resample(peaks = [], n = BARS) {
  if (!peaks.length) {
    // Deterministic pseudo-waveform for uploads without recorded peaks.
    return Array.from({ length: n }, (_, i) => 0.25 + 0.55 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
  }
  return Array.from({ length: n }, (_, i) => {
    const v = peaks[Math.floor((i / n) * peaks.length)] ?? 0;
    return Math.max(0.12, Math.min(1, v));
  });
}

/** Voice note / audio player with seekable waveform and playback speed. */
function VoicePlayer({ att, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const duration = att.duration || 0;
  const bars = useMemo(() => resample(att.waveform), [att.waveform]);
  const src = att.previewUrl || mediaUrl(att.url);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (current === audio) current = null;
      audio?.pause();
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (current && current !== audio) current.pause();
    current = audio;
    audio.playbackRate = speed;
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    const total = Number.isFinite(audio?.duration) ? audio.duration : duration;
    if (!audio || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * total;
    setProgress(ratio);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const played = mine ? "bg-bubble-out-content" : "bg-primary";
  const rest = mine ? "bg-bubble-out-content/35" : "bg-base-content/20";

  return (
    <div className="flex w-[min(68vw,260px)] items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={toggle}
        className={`flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
          mine ? "bg-bubble-out-content/20 text-bubble-out-content" : "bg-primary text-primary-content"
        }`}
        aria-label={playing ? "Pause" : "Play voice message"}
      >
        {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-7 cursor-pointer items-center gap-[2px]" onClick={seek} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} tabIndex={0}>
          {bars.map((v, i) => (
            <span
              key={i}
              className={`w-[3px] shrink-0 rounded-full transition-colors duration-150 ${i / bars.length <= progress ? played : rest}`}
              style={{ height: `${Math.round(v * 100)}%` }}
            />
          ))}
        </div>
        <div className={`mt-0.5 flex items-center justify-between text-[11px] tabular-nums ${mine ? "text-bubble-out-content/75" : "text-base-content/50"}`}>
          <span>{formatDuration(playing || elapsed ? elapsed : duration)}</span>
          {(playing || speed !== 1) && (
            <button type="button" onClick={cycleSpeed} className={`rounded-full px-1.5 font-semibold ${mine ? "bg-bubble-out-content/20" : "bg-base-content/10"}`}>
              {speed}×
            </button>
          )}
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setElapsed(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          const total = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : duration;
          setElapsed(a.currentTime);
          if (total) setProgress(Math.min(1, a.currentTime / total));
        }}
      />
    </div>
  );
}

export default memo(VoicePlayer);
