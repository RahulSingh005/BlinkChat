import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Camera, Check, Clock3, Mail, Pencil, Phone, QrCode, RefreshCw, Target, Trash2, X } from "lucide-react";
import { Card } from "../components/layout/PageShell";
import Avatar from "../components/ui/Avatar";
import Spinner from "../components/ui/Spinner";
import Toggle from "../components/ui/Toggle";
import { errorMessage } from "../lib/api";
import { formatLongDate, formatUntil } from "../lib/format";
import { cropSquare } from "../lib/media";
import { storage } from "../lib/storage";
import { myTimezone, nextWallTime, timeIn, zoneCity } from "../lib/time";
import { uploadFile } from "../lib/upload";
import { useAuthStore } from "../store/useAuthStore";
import { useUIStore } from "../store/useUIStore";

const ABOUT_PRESETS = ["Available", "Busy", "At work", "At the gym", "Battery about to die", "Can't talk, message only", "In a meeting", "Sleeping", "Urgent calls only"];
const STATUS_PRESETS = [
  { emoji: "📅", text: "In a meeting" },
  { emoji: "🚌", text: "Commuting" },
  { emoji: "🤒", text: "Out sick" },
  { emoji: "🌴", text: "On vacation" },
  { emoji: "🏠", text: "Working remotely" },
  { emoji: "🎧", text: "Heads down" },
];
const CLEAR_AFTER = [
  { id: "30m", label: "30 minutes", at: () => new Date(Date.now() + 30 * 60000) },
  { id: "1h", label: "1 hour", at: () => new Date(Date.now() + 60 * 60000) },
  { id: "4h", label: "4 hours", at: () => new Date(Date.now() + 4 * 3600000) },
  { id: "today", label: "Today", at: () => nextWallTime(myTimezone(), 23, 59) },
  { id: "week", label: "This week", at: () => new Date(Date.now() + 7 * 86400000) },
  { id: "never", label: "Don't clear", at: () => null },
];
const FOCUS_FOR = [
  { label: "30 min", at: () => new Date(Date.now() + 30 * 60000) },
  { label: "1 hour", at: () => new Date(Date.now() + 60 * 60000) },
  { label: "2 hours", at: () => new Date(Date.now() + 2 * 3600000) },
  { label: "Until tomorrow", at: () => nextWallTime(myTimezone(), 8, 0) },
];

function EditableRow({ icon: Icon, label, value, placeholder, maxLength, onSave, presets, inputMode }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [busy, setBusy] = useState(false);

  const save = async (next = draft) => {
    if (next.trim() === (value || "")) return setEditing(false);
    setBusy(true);
    try {
      await onSave(next.trim());
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-base-content/50">{label}</p>
          {editing ? (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={maxLength}
              inputMode={inputMode}
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="mt-1 w-full border-b-2 border-primary bg-transparent pb-1 text-[0.95rem] outline-none"
            />
          ) : (
            <p className={`truncate text-[0.95rem] ${value ? "" : "text-base-content/40"}`}>{value || placeholder}</p>
          )}
        </div>
        {editing ? (
          <div className="flex gap-1">
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(false)} aria-label="Cancel">
              <X className="size-4" />
            </button>
            <button type="button" className="icon-btn icon-btn-sm bg-primary text-primary-content hover:bg-primary hover:text-primary-content" onClick={() => save()} aria-label="Save" disabled={busy}>
              {busy ? <Spinner className="size-4" /> : <Check className="size-4" />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => {
              setDraft(value || "");
              setEditing(true);
            }}
            aria-label={`Edit ${label}`}
          >
            <Pencil className="size-4" />
          </button>
        )}
      </div>
      {editing && presets && (
        <div className="no-scrollbar anim-fade mt-3 flex gap-2 overflow-x-auto pl-12">
          {presets.map((p) => (
            <button key={p} type="button" className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => save(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Profile settings (photo, name, about, status, focus mode, time zone). */
export default function ProfileSection() {
  const me = useAuthStore((s) => s.authUser);
  const update = useAuthStore((s) => s.updateProfile);
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState(me.status?.text || "");
  const [statusEmoji, setStatusEmoji] = useState(me.status?.emoji || "💬");
  const [clearAfter, setClearAfter] = useState("today");
  const fileRef = useRef(null);
  const deviceTz = myTimezone();
  const focusing = me.focus?.until && new Date(me.focus.until) > new Date();

  const save = async (patch, ok) => {
    try {
      await update(patch);
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const changePhoto = async (file) => {
    setUploading(true);
    try {
      const cropped = await cropSquare(file);
      const att = await uploadFile(cropped, { purpose: "avatar" });
      await update({ profilePic: att.url });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update your photo"));
    } finally {
      setUploading(false);
    }
  };

  const setStatus = (text, emoji) => {
    const opt = CLEAR_AFTER.find((o) => o.id === clearAfter);
    save({ status: { text, emoji, expiresAt: opt?.at() || null } }, "Status updated");
  };

  return (
    <>
      <section className="flex flex-col items-center pt-2 text-center">
        <div className="relative">
          <Avatar src={me.profilePic} name={me.fullName} seed={me._id} size={120} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-1 right-1 flex size-10 items-center justify-center rounded-full bg-primary text-primary-content shadow-soft ring-4 ring-base-200 transition active:scale-95"
            aria-label="Change profile photo"
            disabled={uploading}
          >
            {uploading ? <Spinner className="size-4" /> : <Camera className="size-[18px]" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) changePhoto(f);
            }}
          />
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{me.fullName}</h2>
        <p className="text-sm text-base-content/55">{me.email}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => useUIStore.getState().open("shareProfile")} className="btn btn-sm h-9 rounded-full border-base-300 bg-base-100 px-4">
            <QrCode className="size-4" /> My QR code
          </button>
          {me.profilePic && (
            <button type="button" onClick={() => save({ profilePic: "" }, "Photo removed")} className="btn btn-ghost btn-sm h-9 rounded-full px-4 text-base-content/60 hover:text-error">
              <Trash2 className="size-4" /> Remove photo
            </button>
          )}
        </div>
      </section>

      <Card title="About you">
        <EditableRow icon={Pencil} label="Name" value={me.fullName} placeholder="Your name" maxLength={60} onSave={(v) => (v ? update({ fullName: v }) : Promise.reject(new Error("Name can't be empty")))} />
        <EditableRow icon={Check} label="About" value={me.about} placeholder="A few words about you" maxLength={150} presets={ABOUT_PRESETS} onSave={(v) => update({ about: v })} />
        <EditableRow icon={Phone} label="Phone" value={me.phone} placeholder="Add a phone number" maxLength={24} inputMode="tel" onSave={(v) => update({ phone: v })} />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
            <Mail className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-base-content/50">Email</p>
            <p className="truncate text-[0.95rem]">{me.email}</p>
          </div>
        </div>
      </Card>

      <Card title="Status" description="A short note people see in your chats. It clears automatically.">
        <div className="space-y-3 p-4">
          {me.status?.text || me.status?.emoji ? (
            <div className="flex items-center gap-3 rounded-xl bg-primary/[0.06] px-3 py-2.5">
              <span className="text-xl">{me.status.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{me.status.text}</p>
                <p className="text-xs text-base-content/50">{me.status.expiresAt ? `Clears ${formatUntil(me.status.expiresAt).replace("until ", "at ")}` : "Doesn't clear automatically"}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm rounded-lg" onClick={() => save({ status: null }, "Status cleared")}>
                Clear
              </button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input value={statusEmoji} onChange={(e) => setStatusEmoji([...e.target.value].slice(-2).join(""))} className="field w-14 px-0 text-center text-lg" aria-label="Status emoji" />
            <input value={statusText} onChange={(e) => setStatusText(e.target.value)} maxLength={80} placeholder="What's your status?" className="field flex-1" onKeyDown={(e) => e.key === "Enter" && statusText.trim() && setStatus(statusText.trim(), statusEmoji)} />
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {STATUS_PRESETS.map((p) => (
              <button key={p.text} type="button" className="chip" onClick={() => setStatus(p.text, p.emoji)}>
                {p.emoji} {p.text}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/60">Clear after</span>
            <select value={clearAfter} onChange={(e) => setClearAfter(e.target.value)} className="select select-bordered select-sm rounded-lg">
              {CLEAR_AFTER.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm ml-auto rounded-lg" disabled={!statusText.trim()} onClick={() => setStatus(statusText.trim(), statusEmoji)}>
              Set status
            </button>
          </div>
        </div>
      </Card>

      <Card title="Focus mode" description="Pause notifications. Contacts see you're focusing and can mark a message urgent if you allow it.">
        <div className="p-4">
          {focusing ? (
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <Target className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Focusing {formatUntil(me.focus.until)}</p>
                <p className="text-xs text-base-content/55">Notifications are paused</p>
              </div>
              <button type="button" className="btn btn-sm rounded-lg" onClick={() => save({ focus: { until: null } }, "Focus mode off")}>
                End now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FOCUS_FOR.map((o) => (
                <button key={o.label} type="button" className="btn h-11 min-h-0 rounded-xl" onClick={() => save({ focus: { until: o.at().toISOString(), allowUrgent: me.focus?.allowUrgent !== false } }, "Focus mode on")}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Toggle
          label="Allow urgent messages"
          description="Messages marked urgent still notify you while focusing (limited to 3 per person per hour)."
          checked={me.focus?.allowUrgent !== false}
          onChange={(v) => save({ focus: { until: focusing ? me.focus.until : null, allowUrgent: v } })}
        />
      </Card>

      <Card title="Time zone" description="Shown to contacts as your local time (you can hide it in Settings → Privacy).">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
            <Clock3 className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem] font-medium">{zoneCity(me.timezone)}</p>
            <p className="text-xs text-base-content/55">
              {me.timezone} · {timeIn(me.timezone)}
            </p>
          </div>
          {me.timezone !== deviceTz && (
            <button
              type="button"
              className="btn btn-sm rounded-lg"
              onClick={() => {
                storage.remove("blinkchat.tzManual");
                save({ timezone: deviceTz }, "Time zone updated");
              }}
            >
              <RefreshCw className="size-3.5" /> Use {zoneCity(deviceTz)}
            </button>
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-base-content/40">Member since {formatLongDate(me.createdAt)}</p>
    </>
  );
}
