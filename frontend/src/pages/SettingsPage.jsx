import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Ban,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  CornerDownLeft,
  Download,
  Eye,
  KeyRound,
  Languages,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Volume2,
} from "lucide-react";
import { PasswordField } from "../components/auth/Fields";
import PageShell, { Card, LinkRow } from "../components/layout/PageShell";
import Avatar from "../components/ui/Avatar";
import Sheet from "../components/ui/Sheet";
import Spinner from "../components/ui/Spinner";
import Toggle from "../components/ui/Toggle";
import { api, errorMessage } from "../lib/api";
import { canInstall, promptInstall, subscribeInstall } from "../lib/install";
import { isIOS, isStandalone } from "../lib/platform";
import { enablePush, disablePush, pushStatus } from "../lib/push";
import { revealThemeChange } from "../lib/transitions";
import { PUSH_OWNER_KEY, useAuthStore } from "../store/useAuthStore";
import { storage } from "../lib/storage";
import { useConfigStore, useFeatures } from "../store/useConfigStore";
import { ACCENTS, FONT_SIZES, WALLPAPERS, useSettingsStore } from "../store/useSettingsStore";

const LANGUAGES = ["en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "ur", "es", "fr", "de", "it", "pt", "ru", "ar", "fa", "tr", "id", "ms", "vi", "th", "zh", "ja", "ko", "nl", "pl", "sv", "uk", "sw"];
const langName = (code) => {
  try {
    return new Intl.DisplayNames([navigator.language || "en"], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
};

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex rounded-xl bg-base-200 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={(e) => onChange(o.value, e)}
          aria-pressed={value === o.value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[0.8125rem] font-medium transition ${
            value === o.value ? "bg-base-100 text-base-content shadow-sm" : "text-base-content/60 hover:text-base-content"
          }`}
        >
          {o.icon && <o.icon className="size-4" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PushRow() {
  const vapid = useConfigStore((s) => s.config?.vapidPublicKey);
  const features = useFeatures();
  const me = useAuthStore((s) => s.authUser);
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushStatus().then(setStatus);
  }, []);

  if (!features.push) return null;
  const unsupported = status === "unsupported";
  const iosHint = isIOS && !isStandalone();

  const toggle = async (on) => {
    setBusy(true);
    try {
      if (on) {
        await enablePush(vapid);
        storage.set(PUSH_OWNER_KEY, me._id);
        toast.success("Push notifications on");
      } else {
        await disablePush();
        storage.remove(PUSH_OWNER_KEY);
      }
    } catch (err) {
      toast.error(err.message || "Couldn't change notifications");
    } finally {
      setStatus(await pushStatus());
      setBusy(false);
    }
  };

  return (
    <div>
      <Toggle
        icon={BellRing}
        label="Push notifications"
        description={
          unsupported
            ? iosHint
              ? "On iPhone, add BlinkChat to your Home Screen first (Share → Add to Home Screen)."
              : "This browser doesn't support push notifications."
            : status === "denied"
              ? "Blocked in your browser settings. Allow notifications for this site to turn them on."
              : "Get notified about messages, calls and reminders even when BlinkChat is closed."
        }
        checked={status === "enabled"}
        disabled={busy || unsupported || status === "denied" || status === "loading"}
        onChange={toggle}
      />
      {status === "enabled" && (
        <div className="-mt-1 px-4 pb-3 pl-16">
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:underline"
            onClick={() =>
              api
                .post("/push/test")
                .then((r) => toast(r.data.delivered ? "Test notification sent" : "No device received it — try re-enabling"))
                .catch((err) => toast.error(errorMessage(err)))
            }
          >
            Send a test notification
          </button>
        </div>
      )}
    </div>
  );
}

function BlockedSheet({ open, onClose }) {
  const [users, setUsers] = useState(null);
  useEffect(() => {
    if (!open) return;
    setUsers(null);
    api
      .get("/users/blocked")
      .then((r) => setUsers(r.data.users))
      .catch(() => setUsers([]));
  }, [open]);

  const unblock = async (u) => {
    try {
      const res = await api.put(`/users/${u._id}/block`);
      useAuthStore.getState().setUser({ blockedUsers: res.data.blockedUsers });
      setUsers((list) => list.filter((x) => x._id !== u._id));
      toast.success(`Unblocked ${u.fullName}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Blocked contacts" description="Blocked people can't message or call you, or see your photo, status and online presence." size="sm">
      {users === null ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-5 text-base-content/40" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-sm text-base-content/50">You haven't blocked anyone.</p>
      ) : (
        <ul className="-mx-2">
          {users.map((u) => (
            <li key={u._id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar src={u.profilePic} name={u.fullName} seed={u._id} size={40} />
              <span className="min-w-0 flex-1 truncate font-medium">{u.fullName}</span>
              <button type="button" className="btn btn-sm rounded-lg" onClick={() => unblock(u)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function PasswordSheet({ open, onClose }) {
  const me = useAuthStore((s) => s.authUser);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (next.length < 6) return toast.error("Use at least 6 characters");
    setBusy(true);
    try {
      await useAuthStore.getState().changePassword({ currentPassword: me.hasPassword ? current : undefined, newPassword: next });
      toast.success("Password updated. Other devices were signed out.");
      setCurrent("");
      setNext("");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={me.hasPassword ? "Change password" : "Set a password"} description={me.hasPassword ? "You'll stay signed in here; other devices will be signed out." : "Add a password so you can also sign in with your email."} size="sm">
      <form onSubmit={save} className="space-y-4 pt-1">
        {me.hasPassword && <PasswordField id="current-password" label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
        <PasswordField id="next-password" label="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <button type="submit" className="btn btn-primary h-11 min-h-0 w-full rounded-xl" disabled={busy || !next || (me.hasPassword && !current)}>
          {busy ? <Spinner className="size-4" /> : "Save password"}
        </button>
      </form>
    </Sheet>
  );
}

function DeleteAccountSheet({ open, onClose }) {
  const me = useAuthStore((s) => s.authUser);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await useAuthStore.getState().deleteAccount({ password, deleteMessages: wipe });
      toast("Your account was deleted.");
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Delete your account" description="This permanently removes your profile, reminders, scheduled messages and group memberships. It can't be undone." size="sm">
      <form onSubmit={remove} className="space-y-4 pt-1">
        {me.hasPassword && <PasswordField id="delete-password" label="Your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-base-200/60 px-3 py-2.5 text-sm">
          <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
          <span>Also delete every message I've sent (otherwise others keep their copy, shown as “Deleted account”).</span>
        </label>
        <div>
          <label htmlFor="confirm-delete" className="field-label">
            Type DELETE to confirm
          </label>
          <input id="confirm-delete" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
        <button type="submit" className="btn btn-error h-11 min-h-0 w-full rounded-xl" disabled={busy || confirm !== "DELETE" || (me.hasPassword && !password)}>
          {busy ? <Spinner className="size-4" /> : "Delete account forever"}
        </button>
      </form>
    </Sheet>
  );
}

export default function SettingsPage() {
  const me = useAuthStore((s) => s.authUser);
  const settings = useSettingsStore();
  const features = useFeatures();
  const installable = useSyncExternalStore(subscribeInstall, canInstall, () => false);
  const [sheet, setSheet] = useState(null);

  const saveServer = async (patch) => {
    try {
      await useAuthStore.getState().updateProfile({ settings: patch });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setTheme = (theme, e) =>
    revealThemeChange(() => useSettingsStore.getState().update({ theme }), e?.clientX, e?.clientY);

  const signOutEverywhere = async () => {
    await useAuthStore.getState().logout({ everywhere: true });
    toast("Signed out of all devices");
  };

  return (
    <PageShell title="Settings" subtitle="Make BlinkChat yours">
      <Link to="/profile" className="flex items-center gap-3 rounded-2xl border border-base-300/70 bg-base-100 p-3.5 transition hover:bg-base-content/[0.02]">
        <Avatar src={me.profilePic} name={me.fullName} seed={me._id} size={52} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{me.fullName}</span>
          <span className="block truncate text-sm text-base-content/55">{me.status?.text ? `${me.status.emoji} ${me.status.text}` : me.about || me.email}</span>
        </span>
        <ChevronRight className="size-5 text-base-content/30" />
      </Link>

      <Card title="Appearance">
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-sm font-medium">Theme</p>
            <Segmented
              value={settings.theme}
              onChange={setTheme}
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Accent color</p>
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(ACCENTS).map(([key, a]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => settings.update({ accent: key })}
                  className={`flex size-10 items-center justify-center rounded-full transition hover:scale-105 ${settings.accent === key ? "ring-2 ring-base-content/70 ring-offset-2 ring-offset-base-100" : ""}`}
                  style={{ background: a.swatch }}
                  aria-label={`${a.label} accent`}
                  aria-pressed={settings.accent === key}
                >
                  {settings.accent === key && <Check className="size-4 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Text size</p>
            <Segmented value={settings.fontSize} onChange={(v) => settings.update({ fontSize: v })} options={Object.entries(FONT_SIZES).map(([value, label]) => ({ value, label: label === "Extra large" ? "XL" : label }))} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Chat wallpaper</p>
            <div className="grid grid-cols-3 gap-2.5">
              {Object.entries(WALLPAPERS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => settings.update({ wallpaper: key })}
                  className={`overflow-hidden rounded-xl border-2 text-left transition ${settings.wallpaper === key ? "border-primary" : "border-transparent hover:border-base-300"}`}
                  aria-pressed={settings.wallpaper === key}
                >
                  <div className={`wallpaper-${key} flex h-16 flex-col justify-end gap-1 p-2`}>
                    <span className="h-2.5 w-3/5 rounded-full bg-bubble-in shadow-sm" />
                    <span className="ml-auto h-2.5 w-1/2 rounded-full bg-primary" />
                  </div>
                  <span className="block bg-base-200/60 px-2 py-1.5 text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Chats">
        <Toggle icon={CornerDownLeft} label="Enter to send" description="Use Shift+Enter for a new line. Turn off to send with the button only." checked={settings.enterToSend} onChange={(v) => settings.update({ enterToSend: v })} />
        {features.ai?.enabled && (
          <>
            <Toggle icon={Sparkles} label="Reply suggestions" description="Show a “Suggest replies” option under new messages." checked={settings.smartReplies} onChange={(v) => settings.update({ smartReplies: v })} />
            <label className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
                <Languages className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-medium">Translate messages into</span>
                <span className="mt-0.5 block text-[0.8125rem] text-base-content/55">Used by Translate and auto-translate.</span>
              </span>
              <select className="select select-bordered select-sm rounded-lg" value={me.settings?.language || "en"} onChange={(e) => saveServer({ language: e.target.value })}>
                {LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {langName(code)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </Card>

      <Card title="Notifications">
        <PushRow />
        <Toggle icon={Volume2} label="Sounds" description="Play a sound for new messages and reminders." checked={settings.sounds} onChange={(v) => settings.update({ sounds: v })} />
        <Toggle icon={Eye} label="Show message previews" description="Include message text in notifications." checked={me.settings?.notificationPreviews !== false} onChange={(v) => saveServer({ notificationPreviews: v })} />
        <Toggle
          icon={Bell}
          label="Desktop alerts"
          description="Show a system alert when BlinkChat is open in a background tab."
          checked={settings.desktopNotifications}
          onChange={async (v) => {
            if (v && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
            settings.update({ desktopNotifications: v });
          }}
        />
      </Card>

      <Card title="Privacy" description="If you hide something, you won't see it for others either.">
        <Toggle icon={Eye} label="Last seen & online" description="Let contacts see when you're online and when you were last active." checked={me.settings?.showLastSeen !== false} onChange={(v) => saveServer({ showLastSeen: v })} />
        <Toggle icon={ShieldCheck} label="Read receipts" description="Let people know when you've read their messages." checked={me.settings?.readReceipts !== false} onChange={(v) => saveServer({ readReceipts: v })} />
        <Toggle icon={Clock3} label="Share my local time" description="Show contacts your local time so they can message at a good moment." checked={me.settings?.shareLocalTime !== false} onChange={(v) => saveServer({ shareLocalTime: v })} />
        <LinkRow icon={Ban} label="Blocked contacts" onClick={() => setSheet("blocked")} right={<ChevronRight className="size-5 text-base-content/30" />} />
      </Card>

      <Card title="Account">
        <LinkRow icon={KeyRound} label={me.hasPassword ? "Change password" : "Set a password"} description={me.authProvider === "google" ? "You signed up with Google" : me.email} onClick={() => setSheet("password")} right={<ChevronRight className="size-5 text-base-content/30" />} />
        <LinkRow icon={Smartphone} label="Log out of all devices" description="Ends every session, including this one." onClick={signOutEverywhere} />
        <LinkRow icon={LogOut} label="Sign out" onClick={() => useAuthStore.getState().logout()} />
        <LinkRow icon={Trash2} label="Delete account" danger onClick={() => setSheet("delete")} />
      </Card>

      <Card title="About">
        {installable && !isStandalone() && (
          <LinkRow icon={Download} label="Install BlinkChat" description="Open it like an app, with its own icon and window." onClick={() => promptInstall()} />
        )}
        {isIOS && !isStandalone() && !installable && (
          <LinkRow icon={Download} label="Add to Home Screen" description="In Safari, tap Share → Add to Home Screen for the app experience and notifications." onClick={() => {}} />
        )}
        <div className="flex items-center justify-between px-4 py-3.5 text-sm text-base-content/55">
          <span>BlinkChat 2.0</span>
          <span className="flex gap-4">
            <Link to="/privacy" className="hover:text-base-content">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-base-content">
              Terms
            </Link>
          </span>
        </div>
      </Card>

      <BlockedSheet open={sheet === "blocked"} onClose={() => setSheet(null)} />
      <PasswordSheet open={sheet === "password"} onClose={() => setSheet(null)} />
      <DeleteAccountSheet open={sheet === "delete"} onClose={() => setSheet(null)} />
    </PageShell>
  );
}
