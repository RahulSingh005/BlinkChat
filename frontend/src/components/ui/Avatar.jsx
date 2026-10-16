import { memo, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { imageVariant } from "../../lib/api";
import { hueFor, initials } from "../../lib/avatar";

/**
 * Photo or initials avatar with an optional presence dot. The dot pings
 * once when someone comes online (never loops).
 */
function Avatar({ src, name = "", seed, size = 40, online = false, group = false, className = "", style, transitionName }) {
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
  const dot = Math.max(8, Math.round(px * 0.27));
  const showImage = src && !failed;

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: px, height: px, viewTransitionName: transitionName, ...style }}
    >
      {showImage ? (
        <img
          src={imageVariant(src, px > 80 ? 320 : 128)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full rounded-full object-cover bg-base-300"
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
