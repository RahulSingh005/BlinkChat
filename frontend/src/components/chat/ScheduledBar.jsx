import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarClock, ChevronRight, CircleAlert, Send, Trash2 } from "lucide-react";
import Sheet from "../ui/Sheet";
import { errorMessage } from "../../lib/api";
import { formatWhen, plural } from "../../lib/format";
import { useChatStore } from "../../store/useChatStore";

/** Strip under the header listing this chat's scheduled messages. */
export default function ScheduledBar({ conv }) {
  const items = useChatStore((s) => s.scheduled[conv._id]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    useChatStore.getState().fetchScheduled(conv._id);
  }, [conv._id]);

  if (!items?.length) return null;
  const next = items.find((i) => i.status === "pending");
  const failed = items.filter((i) => i.status === "failed").length;

  const act = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="anim-slide-down flex w-full shrink-0 items-center gap-2.5 border-b border-base-300/70 bg-base-100 px-4 py-2 text-left text-[0.8125rem] transition hover:bg-base-200/60"
      >
        <CalendarClock className="size-4 text-primary" />
        <span className="font-medium">{plural(items.length, "scheduled message")}</span>
        {next && <span className="text-base-content/55">· next {formatWhen(next.sendAt)}</span>}
        {failed > 0 && (
          <span className="flex items-center gap-1 text-error">
            <CircleAlert className="size-3.5" /> {failed} failed
          </span>
        )}
        <ChevronRight className="ml-auto size-4 text-base-content/40" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Scheduled messages" description="They're sent automatically at the time you picked." size="md">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item._id} className="rounded-2xl border border-base-300/70 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs">
                <CalendarClock className="size-3.5 text-primary" />
                <span className="font-medium">{formatWhen(item.sendAt)}</span>
                {item.status === "failed" && <span className="text-error">· Failed: {item.error}</span>}
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-sm">{item.text || "Attachment"}</p>
              <div className="mt-2 flex justify-end gap-1">
                <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={() => act(() => useChatStore.getState().cancelScheduled(conv._id, item._id), "Canceled")}>
                  <Trash2 className="size-4" /> Cancel
                </button>
                <button type="button" className="btn btn-sm rounded-lg" onClick={() => act(() => useChatStore.getState().sendScheduledNow(conv._id, item._id), "Sending now")}>
                  <Send className="size-4" /> Send now
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
