import { memo, useState } from "react";
import { Check, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import Avatar from "../ui/Avatar";
import { mediaUrl } from "../../lib/api";
import { fitBox } from "../../lib/media";

const TILE_URL = import.meta.env.VITE_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const sub = (mine) => (mine ? "text-bubble-out-content/70" : "text-base-content/55");
const panel = (mine) => (mine ? "bg-bubble-out-content/[0.12]" : "bg-base-content/[0.05]");

// ---- Polls -----------------------------------------------------------------------

export const PollCard = memo(function PollCard({ message, mine, meId, onVote, onEnd, onShowVotes }) {
  const { poll } = message;
  const voters = new Set(poll.options.flatMap((o) => o.voters));
  const total = voters.size;
  const mineVotes = poll.options.filter((o) => o.voters.includes(meId)).map((o) => o.id);
  const closed = Boolean(poll.closedAt);
  const pending = Boolean(message.status);
  const leader = Math.max(0, ...poll.options.map((o) => o.voters.length));

  const toggle = (id) => {
    if (closed || pending) return;
    const next = poll.multiple ? (mineVotes.includes(id) ? mineVotes.filter((x) => x !== id) : [...mineVotes, id]) : mineVotes.includes(id) ? [] : [id];
    onVote(message, next);
  };

  return (
    <div className="w-[min(74vw,300px)] px-3 pb-1.5 pt-2">
      <p className="text-[0.95rem] font-semibold leading-snug">{poll.question}</p>
      <p className={`mt-0.5 text-xs ${sub(mine)}`}>{closed ? "Poll ended" : poll.multiple ? "Select one or more" : "Select one"}</p>
      <ul className="mt-2.5 space-y-2">
        {poll.options.map((o) => {
          const count = o.voters.length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const picked = mineVotes.includes(o.id);
          const winner = closed && count > 0 && count === leader;
          return (
            <li key={o.id}>
              <button type="button" disabled={closed || pending} onClick={() => toggle(o.id)} className="w-full text-left disabled:cursor-default">
                <span className="flex items-center gap-2.5">
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center border-2 transition-colors ${poll.multiple ? "rounded-md" : "rounded-full"} ${
                      picked
                        ? mine
                          ? "border-bubble-out-content bg-bubble-out-content text-bubble-out"
                          : "border-primary bg-primary text-primary-content"
                        : mine
                          ? "border-bubble-out-content/45"
                          : "border-base-content/25"
                    }`}
                  >
                    {picked && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span className={`min-w-0 flex-1 text-[0.9rem] leading-snug ${winner ? "font-semibold" : ""}`}>{o.text}</span>
                  <span className={`shrink-0 text-xs tabular-nums ${sub(mine)}`}>{count}</span>
                </span>
                <span className={`ml-[30px] mt-1.5 block h-1.5 overflow-hidden rounded-full ${panel(mine)}`}>
                  <span
                    className={`block h-full rounded-full transition-[width] duration-500 ease-out ${mine ? "bg-bubble-out-content/80" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className={`mt-2.5 flex items-center justify-between gap-2 border-t pt-1.5 text-xs font-medium ${mine ? "border-bubble-out-content/20" : "border-base-content/10"}`}>
        <button type="button" onClick={() => onShowVotes(message)} className={`py-0.5 ${total ? "hover:underline" : ""} ${sub(mine)}`} disabled={!total}>
          {total ? `${total} vote${total === 1 ? "" : "s"} · View votes` : "No votes yet"}
        </button>
        {mine && !closed && !pending && (
          <button type="button" onClick={() => onEnd(message)} className="py-0.5 font-semibold hover:underline">
            End poll
          </button>
        )}
      </div>
    </div>
  );
});

// ---- Locations ------------------------------------------------------------------

/** Map preview built from OpenStreetMap tiles (no API key). */
export function StaticMap({ lat, lng, width = 280, height = 150, zoom = 15 }) {
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const px = ((lng + 180) / 360) * n * 256;
  const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
  const left0 = px - width / 2;
  const top0 = py - height / 2;
  const tiles = [];
  for (let tx = Math.floor(left0 / 256); tx <= Math.floor((left0 + width) / 256); tx += 1) {
    for (let ty = Math.floor(top0 / 256); ty <= Math.floor((top0 + height) / 256); ty += 1) {
      if (ty < 0 || ty >= n) continue;
      const x = ((tx % n) + n) % n;
      tiles.push({ key: `${tx}-${ty}`, src: TILE_URL.replace("{z}", zoom).replace("{x}", x).replace("{y}", ty), left: tx * 256 - left0, top: ty * 256 - top0 });
    }
  }
  return (
    <span className="relative block overflow-hidden bg-base-300" style={{ height }}>
      <span className="absolute top-0" style={{ left: "50%", width, height, marginLeft: -width / 2 }}>
        {tiles.map((t) => (
          <img key={t.key} src={t.src} alt="" loading="lazy" draggable={false} className="absolute max-w-none select-none" style={{ left: t.left, top: t.top, width: 256, height: 256 }} />
        ))}
      </span>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-md">
        <MapPin className="size-9 fill-error text-white" strokeWidth={1.6} />
      </span>
      <span className="absolute bottom-0 right-0 rounded-tl bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
    </span>
  );
}

export const LocationCard = memo(function LocationCard({ location, mine }) {
  const { lat, lng, label, accuracy } = location;
  const href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="group block w-[min(74vw,280px)] overflow-hidden">
      <StaticMap lat={lat} lng={lng} />
      <span className="flex items-center gap-2 px-3 pb-1 pt-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9rem] font-semibold">{label || "Shared location"}</span>
          <span className={`block truncate text-xs ${sub(mine)}`}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
            {accuracy ? ` · ±${Math.round(accuracy)} m` : ""}
          </span>
        </span>
        <ExternalLink className={`size-4 shrink-0 ${sub(mine)}`} />
      </span>
    </a>
  );
});

// ---- Contacts -------------------------------------------------------------------

export const ContactCard = memo(function ContactCard({ card, mine, isMe, onMessage }) {
  return (
    <div className="w-[min(74vw,260px)] px-2 pb-1 pt-2">
      <div className="flex items-center gap-3 px-1">
        <Avatar src={card.avatar} name={card.name} seed={card.user} size={44} />
        <div className="min-w-0">
          <p className="truncate text-[0.95rem] font-semibold">{card.name || "Contact"}</p>
          <p className={`text-xs ${sub(mine)}`}>{isMe ? "That's you" : "BlinkChat contact"}</p>
        </div>
      </div>
      {!isMe && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMessage(card);
          }}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 border-t pt-2 text-sm font-semibold ${mine ? "border-bubble-out-content/20" : "border-base-content/10 text-primary"}`}
        >
          <MessageCircle className="size-4" /> Message
        </button>
      )}
    </div>
  );
});

// ---- Link previews -----------------------------------------------------------------

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const LinkPreviewCard = memo(function LinkPreviewCard({ preview, mine }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => e.stopPropagation()}
      className={`mx-1 mt-1 block max-w-[300px] overflow-hidden rounded-[12px] transition ${panel(mine)} hover:brightness-[0.97]`}
    >
      {preview.image && imgOk && <img src={mediaUrl(preview.image)} alt="" loading="lazy" onError={() => setImgOk(false)} className="max-h-40 w-full object-cover" />}
      <span className={`block border-l-[3px] px-2.5 py-1.5 ${mine ? "border-bubble-out-content/70" : "border-primary"}`}>
        <span className={`block truncate text-xs font-semibold ${mine ? "" : "text-primary"}`}>{preview.siteName || hostOf(preview.url)}</span>
        {preview.title && <span className="line-clamp-2 text-[0.85rem] font-semibold leading-snug">{preview.title}</span>}
        {preview.description && <span className={`mt-0.5 line-clamp-2 text-[0.8rem] leading-snug ${sub(mine)}`}>{preview.description}</span>}
      </span>
    </a>
  );
});

// ---- GIFs & stickers -------------------------------------------------------------------

export const GifMedia = memo(function GifMedia({ att, autoplay = true, onOpen }) {
  const box = fitBox(att.width, att.height, { maxW: 260, maxH: 260, minW: 120 });
  const src = att.previewUrl || mediaUrl(att.url);
  return (
    <button type="button" onClick={onOpen} className="relative block overflow-hidden bg-base-content/10" style={{ width: box.width, height: box.height, maxWidth: "100%" }} aria-label="Open GIF">
      {att.mp4 && autoplay ? (
        <video src={att.mp4} poster={src} autoPlay loop muted playsInline className="size-full object-cover" />
      ) : (
        <img src={src} alt={att.name || "GIF"} loading="lazy" className="size-full object-cover" />
      )}
      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/50 px-1 text-[10px] font-bold tracking-wide text-white">GIF</span>
    </button>
  );
});

export const StickerMedia = memo(function StickerMedia({ att }) {
  return <img src={att.previewUrl || mediaUrl(att.url)} alt={att.name || "Sticker"} loading="lazy" draggable={false} className="size-[148px] select-none object-contain drop-shadow-sm" />;
});

// ---- View once ---------------------------------------------------------------------------

export const ViewOnceTile = memo(function ViewOnceTile({ message, mine, meId, onOpen }) {
  const att = message.attachments[0];
  const viewers = message.viewedBy || [];
  const opened = mine ? viewers.length > 0 : message.viewOnceOpened || viewers.includes(meId);
  const label = att?.kind === "video" ? "Video" : "Photo";
  const canOpen = mine ? Boolean(message.viewOnceMedia) : !opened && !message.status;
  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(message);
      }}
      className="flex min-w-[190px] items-center gap-3 px-3 pb-1 pt-2.5 text-left disabled:cursor-default"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${opened ? "border-dashed opacity-60" : ""} ${mine ? "border-bubble-out-content/70" : "border-primary text-primary"}`}>
        <span className="text-[13px] font-bold">1</span>
      </span>
      <span className="min-w-0">
        <span className={`block text-[0.9rem] font-semibold ${opened && !mine ? "opacity-60" : ""}`}>{opened && !mine ? "Opened" : label}</span>
        <span className={`block text-xs ${sub(mine)}`}>{mine ? (opened ? "Opened" : "View once") : opened ? "View once" : "Tap to view once"}</span>
      </span>
    </button>
  );
});

// ---- Status replies ---------------------------------------------------------------------

export const StoryReplyQuote = memo(function StoryReplyQuote({ reply, mine, ownerName }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className={`mx-1 mt-1 flex min-w-[170px] max-w-[300px] items-stretch overflow-hidden rounded-[10px] ${panel(mine)}`}>
      <span className={`w-[3px] shrink-0 ${mine ? "bg-bubble-out-content/70" : "bg-primary"}`} />
      <span className="min-w-0 flex-1 px-2 py-1.5">
        <span className={`block truncate text-xs font-semibold ${mine ? "" : "text-primary"}`}>{ownerName} · Status</span>
        <span className="line-clamp-2 text-[0.8125rem] opacity-80">{reply.text || (reply.mediaKind === "video" ? "🎥 Video" : reply.storyType === "text" ? "Status" : "📷 Photo")}</span>
      </span>
      {reply.storyType === "text" ? (
        <span className="flex w-11 shrink-0 items-center justify-center text-[10px] font-bold text-white" style={{ background: reply.background || "#5B5BD6" }}>
          Aa
        </span>
      ) : reply.mediaUrl && imgOk && reply.mediaKind === "image" ? (
        <img src={mediaUrl(reply.mediaUrl)} alt="" onError={() => setImgOk(false)} className="w-11 shrink-0 object-cover" />
      ) : null}
    </div>
  );
});
