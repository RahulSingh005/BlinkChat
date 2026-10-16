import { memo, useState } from "react";
import { Play } from "lucide-react";
import { imageVariant, mediaUrl } from "../../lib/api";
import { formatDuration } from "../../lib/format";
import { fitBox } from "../../lib/media";

function ProgressRing({ value = 0 }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
      <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow" aria-label={`Uploading ${Math.round(value * 100)}%`}>
        <circle cx="24" cy="24" r={r} fill="rgb(0 0 0 / 0.35)" stroke="rgb(255 255 255 / 0.25)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.04, value))}
          transform="rotate(-90 24 24)"
          style={{ transition: "stroke-dashoffset 0.25s ease-out" }}
        />
      </svg>
    </span>
  );
}

/** Keeps whichever source loaded first (local preview → CDN copy). */
function useStableSrc(att, width) {
  const remote = att.local ? att.url : att.kind === "image" ? imageVariant(att.url, width) : mediaUrl(att.url);
  const [src, setSrc] = useState(att.previewUrl || remote);
  const onError = () => {
    if (src !== remote) setSrc(remote);
  };
  return [src, onError];
}

function Tile({ att, box, onOpen, uploading, overlay }) {
  const [src, onError] = useStableSrc(att, 720);
  const [loaded, setLoaded] = useState(false);
  const isVideo = att.kind === "video";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/tile relative block overflow-hidden bg-base-content/10"
      style={box}
      aria-label={isVideo ? "Play video" : "Open photo"}
    >
      {isVideo ? (
        <video src={src} preload="metadata" muted playsInline className="size-full object-cover" onLoadedData={() => setLoaded(true)} onError={onError} />
      ) : (
        <img
          src={src}
          alt={att.name || "Photo"}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={onError}
          className={`size-full object-cover transition-[filter,opacity] duration-500 ${loaded ? "opacity-100 blur-0" : "opacity-60 blur-md"}`}
        />
      )}
      {isVideo && !uploading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition group-hover/tile:scale-105">
            <Play className="ml-0.5 size-6 fill-current" />
          </span>
          {att.duration ? (
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">{formatDuration(att.duration)}</span>
          ) : null}
        </span>
      )}
      {uploading && <ProgressRing value={att.progress} />}
      {overlay}
    </button>
  );
}

/** Photos/videos inside a bubble: 1 large, or a 2-column grid with "+N". */
function MediaGrid({ attachments, onOpen, uploading = false, maxWidth = 300 }) {
  if (attachments.length === 1) {
    const att = attachments[0];
    const box = fitBox(att.width, att.height, { maxW: maxWidth, maxH: 360 });
    return <Tile att={att} box={{ width: box.width, height: box.height, maxWidth: "100%" }} onOpen={() => onOpen(0)} uploading={uploading} />;
  }
  const shown = attachments.slice(0, 4);
  const extra = attachments.length - shown.length;
  const cell = Math.floor((maxWidth - 2) / 2);
  return (
    <div className="grid grid-cols-2 gap-0.5" style={{ width: maxWidth, maxWidth: "100%" }}>
      {shown.map((att, i) => (
        <Tile
          key={`${att.url}-${i}`}
          att={att}
          box={{ width: "100%", height: shown.length === 3 && i === 0 ? cell * 2 + 2 : cell, gridRow: shown.length === 3 && i === 0 ? "span 2" : undefined }}
          onOpen={() => onOpen(i)}
          uploading={uploading}
          overlay={
            i === 3 && extra > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">+{extra}</span>
            ) : null
          }
        />
      ))}
    </div>
  );
}

export default memo(MediaGrid);
