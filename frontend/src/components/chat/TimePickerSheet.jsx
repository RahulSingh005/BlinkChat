import { useMemo, useState } from "react";
import { ChevronRight, Clock3, Moon, Sun, Sunrise, Timer } from "lucide-react";
import Sheet from "../ui/Sheet";
import { formatTime, formatWhen } from "../../lib/format";
import { differentZone, isValidTz, myTimezone, nextWallTime, quickTimes, timeIn } from "../../lib/time";

const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Time picker for "Send later" and "Remind me". Quick picks are computed in
 * the viewer's zone, plus "their morning" when the contact's zone differs.
 */
export default function TimePickerSheet({ open, onClose, title, description, onPick, theirTimezone, theirName, withNote = false, reminder = false, submitLabel = "Schedule" }) {
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");

  const options = useMemo(() => {
    if (!open) return [];
    const now = new Date();
    const { inMinutes, evening, morning } = quickTimes(now);
    const list = reminder
      ? [
          { label: "In 20 minutes", at: inMinutes(20), icon: Timer },
          { label: "In 1 hour", at: inMinutes(60), icon: Clock3 },
          { label: "In 3 hours", at: inMinutes(180), icon: Clock3 },
        ]
      : [{ label: "In 1 hour", at: inMinutes(60), icon: Clock3 }];
    list.push({ label: evening.getDate() === now.getDate() ? "This evening" : "Tomorrow evening", at: evening, icon: Moon });
    list.push({ label: morning.getDate() === now.getDate() ? "This morning" : "Tomorrow morning", at: morning, icon: Sun });
    if (isValidTz(theirTimezone) && differentZone(theirTimezone, myTimezone())) {
      const theirs = nextWallTime(theirTimezone, 9, 0, now);
      list.push({
        label: `${theirName ? `${theirName}'s` : "Their"} morning`,
        hint: `9:00 AM their time · ${formatWhen(theirs)} yours`,
        at: theirs,
        icon: Sunrise,
        highlight: true,
      });
    }
    return list;
  }, [open, reminder, theirTimezone, theirName]);

  const pick = (date) => {
    onPick(date, note.trim());
    setCustom("");
    setNote("");
    onClose();
  };

  const customDate = custom ? new Date(custom) : null;
  const customValid = customDate && !Number.isNaN(customDate.getTime()) && customDate.getTime() > Date.now() + 60 * 1000;

  return (
    <Sheet open={open} onClose={onClose} title={title} description={description} size="sm">
      {withNote && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Add a note (optional)"
          className="field mb-3"
        />
      )}
      <div className="space-y-1">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => pick(o.at)}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-base-content/[0.05] ${o.highlight ? "bg-primary/[0.06]" : ""}`}
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${o.highlight ? "bg-primary/15 text-primary" : "bg-base-200 text-base-content/70"}`}>
              <o.icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.95rem] font-medium">{o.label}</span>
              <span className="block truncate text-xs text-base-content/55">{o.hint || formatWhen(o.at)}</span>
            </span>
            <ChevronRight className="size-4 text-base-content/30" />
          </button>
        ))}
      </div>
      <div className="mt-4 border-t border-base-300/70 pt-4">
        <label className="field-label" htmlFor="custom-time">
          Pick a date & time
        </label>
        <div className="flex gap-2">
          <input
            id="custom-time"
            type="datetime-local"
            value={custom}
            min={toLocalInput(new Date(Date.now() + 2 * 60 * 1000))}
            onChange={(e) => setCustom(e.target.value)}
            className="field flex-1"
          />
          <button type="button" className="btn btn-primary h-12 min-h-0 rounded-xl" disabled={!customValid} onClick={() => pick(customDate)}>
            {submitLabel}
          </button>
        </div>
        {customValid && theirTimezone && isValidTz(theirTimezone) && differentZone(theirTimezone, myTimezone()) && (
          <p className="mt-2 text-xs text-base-content/55">
            That's {timeIn(theirTimezone, customDate)} for {theirName || "them"} · {formatTime(customDate)} for you
          </p>
        )}
      </div>
    </Sheet>
  );
}
