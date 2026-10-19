import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AlarmClock, Check, Clock3, EllipsisVertical, MessageSquare, Trash2 } from "lucide-react";
import PanelHeader from "../components/layout/PanelHeader";
import SplitView, { DetailPlaceholder } from "../components/layout/SplitView";
import Menu from "../components/ui/Menu";
import { ConversationSkeleton } from "../components/ui/Skeletons";
import { useNow } from "../hooks/useNow";
import { errorMessage } from "../lib/api";
import { formatAgoShort, formatWhen } from "../lib/format";
import { quickTimes } from "../lib/time";
import { conversationTitle, useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useReminderStore } from "../store/useReminderStore";

function ReminderItem({ r, due, onOpen, index }) {
  const [menu, setMenu] = useState(null);
  const me = useAuthStore((s) => s.authUser);
  const conv = useChatStore((s) => s.conversations[r.conversation]);
  const store = useReminderStore.getState();

  const snooze = async (date) => {
    try {
      await store.snooze(r._id, date);
      toast.success(`Snoozed · ${formatWhen(date)}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const { inMinutes, evening, morning } = quickTimes();

  return (
    <li className="anim-cascade" style={{ "--i": index }}>
      <div className={`flex gap-3 rounded-2xl p-3 transition hover:bg-base-content/[0.03] ${due ? "bg-warning/[0.07]" : ""}`}>
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${due ? "bg-warning/15 text-warning" : "bg-base-200 text-base-content/60"}`}
        >
          {due ? <AlarmClock className="size-5" /> : <Clock3 className="size-5" />}
        </span>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-xs text-base-content/55">
            {due ? `Due ${formatAgoShort(r.firedAt || r.remindAt)} ago` : formatWhen(r.remindAt)} · {r.preview?.senderName}
            {conv ? ` in ${conversationTitle(conv, me._id)}` : ""}
          </p>
          {r.note && <p className="mt-0.5 font-semibold">{r.note}</p>}
          <p className="mt-0.5 line-clamp-2 text-sm text-base-content/75">{r.preview?.text}</p>
        </button>
        <div className="flex shrink-0 flex-col items-center gap-1">
          {due && (
            <button type="button" className="icon-btn icon-btn-sm text-success" onClick={() => store.markDone(r._id)} aria-label="Mark done">
              <Check className="size-[18px]" />
            </button>
          )}
          <button type="button" className="icon-btn icon-btn-sm" onClick={(e) => setMenu({ anchor: e.currentTarget })} aria-label="Reminder options">
            <EllipsisVertical className="size-4" />
          </button>
        </div>
      </div>
      <Menu
        open={Boolean(menu)}
        anchor={menu?.anchor}
        onClose={() => setMenu(null)}
        title="Reminder"
        items={[
          { key: "open", label: "Open message", icon: MessageSquare, onSelect: onOpen },
          { section: "Snooze" },
          { key: "1h", label: "In 1 hour", hint: formatWhen(inMinutes(60)), icon: Clock3, onSelect: () => snooze(inMinutes(60)) },
          { key: "eve", label: "This evening", hint: formatWhen(evening), icon: Clock3, onSelect: () => snooze(evening) },
          { key: "morn", label: "Tomorrow morning", hint: formatWhen(morning), icon: Clock3, onSelect: () => snooze(morning) },
          "divider",
          due && { key: "done", label: "Mark as done", icon: Check, onSelect: () => store.markDone(r._id) },
          { key: "del", label: "Delete", icon: Trash2, danger: true, onSelect: () => store.remove(r._id) },
        ]}
      />
    </li>
  );
}

function RemindersList() {
  const navigate = useNavigate();
  const items = useReminderStore((s) => s.items);
  const loaded = useReminderStore((s) => s.loaded);
  useNow(30000);

  const due = items.filter((r) => r.status === "fired").sort((a, b) => new Date(b.firedAt || b.remindAt) - new Date(a.firedAt || a.remindAt));
  const upcoming = items.filter((r) => r.status === "pending").sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));
  const open = (r) => navigate(`/chat/${r.conversation}?message=${r.message}`);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-base-100">
      <PanelHeader title="Reminders" subtitle="Messages you asked BlinkChat to bring back" />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-2 pb-28 pt-2 md:pb-4">
        {!loaded ? (
          <ConversationSkeleton rows={4} />
        ) : !items.length ? (
          <div className="anim-fade mx-auto max-w-xs px-4 py-14 text-center">
            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-base-200 text-base-content/50">
              <AlarmClock className="size-6" />
            </span>
            <h2 className="font-semibold">No reminders yet</h2>
            <p className="mt-1 text-sm text-base-content/55">
              Long-press (or right-click) any message and choose “Remind me” to get it back at the right time.
            </p>
          </div>
        ) : (
          <>
            {due.length > 0 && (
              <section>
                <h2 className="px-2 pb-1 text-[0.8125rem] font-semibold text-warning">Due</h2>
                <ul className="space-y-1">
                  {due.map((r, i) => (
                    <ReminderItem key={r._id} r={r} due index={i} onOpen={() => open(r)} />
                  ))}
                </ul>
              </section>
            )}
            {upcoming.length > 0 && (
              <section>
                <h2 className="px-2 pb-1 text-[0.8125rem] font-semibold text-base-content/55">Upcoming</h2>
                <ul className="space-y-1">
                  {upcoming.map((r, i) => (
                    <ReminderItem key={r._id} r={r} index={i + due.length} onOpen={() => open(r)} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function RemindersPage() {
  return (
    <SplitView
      list={<RemindersList />}
      detail={
        <DetailPlaceholder
          icon={AlarmClock}
          title="Never forget to reply"
          body="Right-click (or long-press) any message and pick “Remind me”. BlinkChat brings it back right on time, even if the app is closed."
        />
      }
    />
  );
}
