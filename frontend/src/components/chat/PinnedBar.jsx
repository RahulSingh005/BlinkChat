import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pin, PinOff } from "lucide-react";
import { errorMessage, imageVariant } from "../../lib/api";
import { previewText } from "../../lib/preview";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatStore } from "../../store/useChatStore";

/**
 * Pinned messages strip under the chat header (Telegram style): tap to
 * jump to the pinned message; with several pins each tap moves to the next.
 */
export default function PinnedBar({ conv }) {
  const me = useAuthStore((s) => s.authUser);
  const pins = conv.pinned || [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= pins.length) setIndex(0);
  }, [pins.length, index]);

  if (!pins.length) return null;
  const current = pins[Math.min(index, pins.length - 1)];
  const msg = current.message;
  const thumb = msg.attachments?.find((a) => a.kind === "image" && a.url);
  const canUnpin = conv.type !== "group" || conv.me.role === "admin";

  const jump = () => {
    useChatStore.getState().jumpToMessage(conv._id, msg._id);
    if (pins.length > 1) setIndex((i) => (i + 1) % pins.length);
  };

  const unpin = async () => {
    try {
      await useChatStore.getState().unpinMessage(conv._id, msg._id);
      toast.success("Unpinned");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="anim-slide-down flex h-[52px] shrink-0 items-center gap-3 border-b border-base-300/70 bg-base-100 pl-4 pr-2">
      <div className="flex h-9 w-[3px] shrink-0 flex-col gap-[2px]" aria-hidden="true">
        {pins.map((p, i) => (
          <span key={p.message._id} className={`flex-1 rounded-full transition-colors ${i === index ? "bg-primary" : "bg-primary/25"}`} />
        ))}
      </div>
      <button type="button" onClick={jump} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        {thumb && <img src={imageVariant(thumb.url, 80)} alt="" className="size-9 shrink-0 rounded-md object-cover" />}
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Pin className="size-3 rotate-45" /> Pinned message{pins.length > 1 ? ` ${index + 1} of ${pins.length}` : ""}
          </span>
          <span className="block truncate text-[0.875rem] text-base-content/75">{previewText(msg, { conv, meId: me._id }) || "Message"}</span>
        </span>
      </button>
      {canUnpin && (
        <button type="button" className="icon-btn icon-btn-sm" onClick={unpin} aria-label="Unpin message" title="Unpin">
          <PinOff className="size-4" />
        </button>
      )}
    </div>
  );
}
