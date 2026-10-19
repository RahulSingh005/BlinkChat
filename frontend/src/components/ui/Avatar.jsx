import { memo, useEffect, useRef, useState } from "react";
import { Bookmark, Users } from "lucide-react";
import { imageVariant } from "../../lib/api";
import { hueFor, initials } from "../../lib/avatar";

/**
 * Photo or initials avatar with an optional presence dot. The dot pings
 * once when someone comes online (never loops). `self` renders the Saved
 * Messages bookmark.
 */
function Avatar({ src, name = "", seed, size = 40, online = false, group = false, self = false, className = "", style, transitionName }) {
  const [failed, setFailed] = useState(false);
  const wasOnline = useRef(online);
  const [justOnline, setJustOnline] = useState(false);

  useEffect(() => setFailed(false), [src]);
  useEffect(() => {
    if (online && !wasOnline.current) {
      setJustOnline(true);
      const t = setTimeout(() => setJustOnline(false), 1000);
      wasOnline.current = online;
      return () => clearTimeout(t);
    }
    wasOnline.current = online;
  }, [online]);

  const px = typeof size === "number" ? size : 40;
  const dot = Math.max(8, Math.round(px * 0.26));
  const showImage = src && !failed && !self;

  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: px, height: px, viewTransitionName: transitionName, ...style }}>
      {self ? (
        <span aria-hidden="true" className="flex size-full items-center justify-center rounded-full bg-primary text-primary-content">
          <Bookmark style={{ width: px * 0.44, height: px * 0.44 }} strokeWidth={2.2} />
        </span>
      ) : showImage ? (
        <img
          src={imageVariant(src, px > 80 ? 320 : 128)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full rounded-full bg-base-300 object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="avatar-tint flex size-full select-none items-center justify-center rounded-full font-semibold"
          style={{ "--h": hueFor(seed || name), fontSize: Math.round(px * 0.38) }}
        >
          {group && !name ? <Users style={{ width: px * 0.45, height: px * 0.45 }} /> : initials(name)}
        </span>
      )}
      {online && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-base-100 ${justOnline ? "ping-once" : ""}`}
          style={{ width: dot, height: dot }}
          aria-label="Online"
        />
      )}
    </span>
  );
}

export default memo(Avatar);

/**
 * Segmented story ring around any avatar: one arc per story, grey once
 * seen (like WhatsApp's status ring).
 */
export function StoryRing({ count = 1, seenCount = 0, size, children, className = "" }) {
  const gap = count > 1 ? 4 : 0;
  const seg = 360 / count;
  const stops = [];
  for (let i = 0; i < count; i += 1) {
    const color = i < seenCount ? "oklch(var(--bc) / 0.25)" : "oklch(var(--p))";
    const start = i * seg + gap / 2;
    const end = (i + 1) * seg - gap / 2;
    stops.push(`transparent ${i * seg}deg ${start}deg`, `${color} ${start}deg ${end}deg`, `transparent ${end}deg ${(i + 1) * seg}deg`);
  }
  return (
    <span className={`relative inline-flex shrink-0 rounded-full p-[3px] ${className}`} style={{ background: `conic-gradient(${stops.join(",")})`, width: size, height: size }}>
      <span className="flex size-full rounded-full bg-base-100 p-[2px]">{children}</span>
    </span>
  );
}
