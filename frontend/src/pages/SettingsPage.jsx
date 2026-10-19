import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Ban,
  Bell,
  BellRing,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  CornerDownLeft,
  Download,
  Eye,
  Film,
  Info,
  Keyboard,
  KeyRound,
  Languages,
  Link2,
  Lock,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Palette,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  Volume2,
} from "lucide-react";
import { PasswordField } from "../components/auth/Fields";
import PanelHeader from "../components/layout/PanelHeader";
import SectionShell, { Card, LinkRow } from "../components/layout/PageShell";
import SplitView from "../components/layout/SplitView";
import Avatar from "../components/ui/Avatar";
import Sheet from "../components/ui/Sheet";
import Spinner from "../components/ui/Spinner";
import Toggle from "../components/ui/Toggle";
import { useIsWide } from "../hooks/useMediaQuery";
import { api, errorMessage } from "../lib/api";
import { canInstall, promptInstall, subscribeInstall } from "../lib/install";
import { isIOS, isStandalone, modKey } from "../lib/platform";
import { enablePush, disablePush, pushStatus } from "../lib/push";
import { storage } from "../lib/storage";
import { revealThemeChange, setNavDirection } from "../lib/transitions";
import { PUSH_OWNER_KEY, useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useConfigStore, useFeatures } from "../store/useConfigStore";
import { AUTO_LOCK, useLockStore } from "../store/useLockStore";
import { ACCENTS, BUBBLE_STYLES, FONT_SIZES, WALLPAPERS, useSettingsStore } from "../store/useSettingsStore";
import { useUIStore } from "../store/useUIStore";

const ProfileSection = lazy(() => import("./ProfilePage"));

const LANGUAGES = ["en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "ur", "es", "fr", "de", "it", "pt", "ru", "ar", "fa", "tr", "id", "ms", "vi", "th", "zh", "ja", "ko", "nl", "pl", "sv", "uk", "sw"];
const langName = (code) => {
  try {
    return new Intl.DisplayNames([navigator.language || "en"], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
};

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound, hint: "Photo, name, about, status" },
  { id: "account", label: "Account", icon: KeyRound, hint: "Password, devices, delete account" },
  { id: "privacy", label: "Privacy", icon: Lock, hint: "Last seen, read receipts, app lock" },
  { id: "chats", label: "Chats", icon: MessageSquare, hint: "Enter to send, previews, translation" },
  { id: "appearance", label: "Appearance", icon: Palette, hint: "Theme, colors, bubbles, wallpaper" },
  { id: "notifications", label: "Notifications", icon: Bell, hint: "Push, sounds, previews" },
  { id: "help", label: "Help & about", icon: Info, hint: "Shortcuts, install, legal" },
];

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

const Chevron = () => <ChevronRight className="size-5 text-base-content/30" />;

// ---- Notifications ---------------------------------------------------------------

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

function NotificationsSection() {
  const me = useAuthStore((s) => s.authUser);
  const settings = useSettingsStore();
  const saveServer = useSaveServer();
  return (
    <Card>
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
  );
}

// ---- Account ------------------------------------------------------------------------

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
    <Sheet
      open={open}
      onClose={onClose}
      title={me.hasPassword ? "Change password" : "Set a password"}
      description={me.hasPassword ? "You'll stay signed in here; other devices will be signed out." : "Add a password so you can also sign in with your email."}
      size="sm"
    >
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
    <Sheet open={open} onClose={onClose} title="Delete your account" description="This permanently removes your profile, reminders, scheduled messages, status updates and group memberships. It can't be undone." size="sm">
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

function AccountSection() {
  const me = useAuthStore((s) => s.authUser);
  const [sheet, setSheet] = useState(null);
  const signOutEverywhere = async () => {
    const ok = await useUIStore.getState().ask({ title: "Log out of all devices?", body: "You'll need to sign in again everywhere, including here.", confirmLabel: "Log out everywhere", danger: true });
    if (!ok) return;
    await useAuthStore.getState().logout({ everywhere: true });
    toast("Signed out of all devices");
  };
  return (
    <>
      <Card title="Sign-in">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
            <UserRound className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.95rem] font-medium">{me.email}</span>
            <span className="block text-[0.8125rem] text-base-content/55">{me.authProvider === "google" ? "Signed up with Google" : "Email & password"}</span>
          </span>
        </div>
        <LinkRow icon={KeyRound} label={me.hasPassword ? "Change password" : "Set a password"} description="Changing it signs out your other devices" onClick={() => setSheet("password")} right={<Chevron />} />
      </Card>
      <Card title="Sessions">
        <LinkRow icon={Smartphone} label="Log out of all devices" description="Ends every session, including this one." onClick={signOutEverywhere} />
        <LinkRow icon={LogOut} label="Sign out" description="Sign out of this device" onClick={() => useAuthStore.getState().logout()} />
      </Card>
      <Card title="Danger zone">
        <LinkRow icon={Trash2} label="Delete account" description="Permanently delete your account and data" danger onClick={() => setSheet("delete")} />
      </Card>
      <PasswordSheet open={sheet === "password"} onClose={() => setSheet(null)} />
      <DeleteAccountSheet open={sheet === "delete"} onClose={() => setSheet(null)} />
    </>
  );
}

// ---- Privacy -------------------------------------------------------------------------

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

/** Set a 4-6 digit PIN (entered twice). */
function PinSheet({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setFirst("");
      setPin("");
    }
  }, [open]);

  const next = async (e) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) return toast.error("Use 4 to 6 digits");
    if (step === 1) {
      setFirst(pin);
      setPin("");
      setStep(2);
      return undefined;
    }
    if (pin !== first) {
      toast.error("PINs don't match. Try again.");
      setStep(1);
      setFirst("");
      setPin("");
      return undefined;
    }
    setBusy(true);
    await useLockStore.getState().enable(pin, 60 * 1000);
    setBusy(false);
    toast.success("App lock is on");
    onClose();
    return undefined;
  };

  return (
    <Sheet open={open} onClose={onClose} title={step === 1 ? "Create a PIN" : "Confirm your PIN"} description="You'll enter it to open BlinkChat on this device. It never leaves this browser." size="sm">
      <form onSubmit={next} className="space-y-4 pt-1">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="off"
          type="password"
          placeholder="4–6 digits"
          className="field text-center text-2xl tracking-[0.5em]"
          data-autofocus
          aria-label="PIN"
        />
        <button type="submit" className="btn btn-primary h-11 min-h-0 w-full rounded-xl" disabled={pin.length < 4 || busy}>
          {busy ? <Spinner className="size-4" /> : step === 1 ? "Next" : "Turn on app lock"}
        </button>
      </form>
    </Sheet>
  );
}

function AppLockCard() {
  const config = useLockStore((s) => s.config);
  const [open, setOpen] = useState(false);
  const disable = async () => {
    const ok = await useUIStore.getState().ask({ title: "Turn off app lock?", body: "BlinkChat will open without a PIN on this device.", confirmLabel: "Turn off" });
    if (ok) {
      useLockStore.getState().disable();
      toast("App lock is off");
    }
  };
  return (
    <Card title="App lock" description="Require a PIN to open BlinkChat on this device.">
      <Toggle icon={Lock} label="Lock with PIN" description={config ? "On for this browser" : "Off"} checked={Boolean(config)} onChange={(v) => (v ? setOpen(true) : disable())} />
      {config && (
        <label className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
            <Clock3 className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.95rem] font-medium">Lock automatically</span>
            <span className="mt-0.5 block text-[0.8125rem] text-base-content/55">When BlinkChat is in the background</span>
          </span>
          <select className="select select-bordered select-sm rounded-lg" value={config.autoLockMs ?? 60000} onChange={(e) => useLockStore.getState().setAutoLock(Number(e.target.value))}>
            {AUTO_LOCK.map((o) => (
              <option key={o.ms} value={o.ms}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {config && <LinkRow icon={KeyRound} label="Change PIN" onClick={() => setOpen(true)} right={<Chevron />} />}
      <PinSheet open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function PrivacySection() {
  const me = useAuthStore((s) => s.authUser);
  const saveServer = useSaveServer();
  const [blocked, setBlocked] = useState(false);
  return (
    <>
      <Card title="Who can see my info" description="If you hide something, you won't see it for others either.">
        <Toggle icon={Eye} label="Last seen & online" description="Let contacts see when you're online and when you were last active." checked={me.settings?.showLastSeen !== false} onChange={(v) => saveServer({ showLastSeen: v })} />
        <Toggle icon={ShieldCheck} label="Read receipts" description="Show blue ticks and status views. Turning this off also hides them for you." checked={me.settings?.readReceipts !== false} onChange={(v) => saveServer({ readReceipts: v })} />
        <Toggle icon={Clock3} label="Share my local time" description="Show contacts your local time so they can message at a good moment." checked={me.settings?.shareLocalTime !== false} onChange={(v) => saveServer({ shareLocalTime: v })} />
      </Card>
      <AppLockCard />
      <Card>
        <LinkRow icon={Ban} label="Blocked contacts" onClick={() => setBlocked(true)} right={<Chevron />} />
      </Card>
      <BlockedSheet open={blocked} onClose={() => setBlocked(false)} />
    </>
  );
}

// ---- Chats ------------------------------------------------------------------------------

function ChatsSection() {
  const me = useAuthStore((s) => s.authUser);
  const settings = useSettingsStore();
  const features = useFeatures();
  const saveServer = useSaveServer();
  const navigate = useNavigate();

  const openSaved = async () => {
    try {
      const conv = await useChatStore.getState().openSelf();
      navigate(`/chat/${conv._id}`, { viewTransition: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <Card title="Typing">
        <Toggle icon={CornerDownLeft} label="Enter to send" description="Use Shift+Enter for a new line. Turn off to send with the button only." checked={settings.enterToSend} onChange={(v) => settings.update({ enterToSend: v })} />
      </Card>
      <Card title="Media">
        <Toggle icon={Link2} label="Link previews" description="Show a title and image for links in messages." checked={settings.linkPreviews !== false} onChange={(v) => settings.update({ linkPreviews: v })} />
        <Toggle icon={Film} label="Autoplay GIFs" description="Play GIFs automatically in chats." checked={settings.autoplayGifs !== false} onChange={(v) => settings.update({ autoplayGifs: v })} />
      </Card>
      {features.ai?.enabled && (
        <Card title="Smart features">
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
        </Card>
      )}
      <Card>
        <LinkRow icon={Bookmark} label="Saved messages" description="Your private notes chat" onClick={openSaved} right={<Chevron />} />
      </Card>
    </>
  );
}

// ---- Appearance -------------------------------------------------------------------------

function BubblePreview({ style }) {
  return (
    <div className="wallpaper-plain flex h-24 flex-col justify-center gap-1.5 rounded-xl px-3">
      <span className="w-3/5 self-start rounded-2xl rounded-bl-md bg-bubble-in px-3 py-1.5 text-[11px] shadow-bubble">Hey! Are we still on?</span>
      <span
        className={`w-1/2 self-end rounded-2xl rounded-br-md px-3 py-1.5 text-[11px] shadow-bubble ${style === "soft" ? "" : "bg-primary text-primary-content"}`}
        style={style === "soft" ? { background: "color-mix(in oklch, oklch(var(--p)) 22%, rgb(var(--bubble-in)))" } : undefined}
      >
        Yes, see you at 7 🎉
      </span>
    </div>
  );
}

function AppearanceSection() {
  const settings = useSettingsStore();
  const setTheme = (theme, e) => revealThemeChange(() => useSettingsStore.getState().update({ theme }), e?.clientX, e?.clientY);
  return (
    <>
      <Card title="Theme">
        <div className="space-y-5 p-4">
          <Segmented
            value={settings.theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ]}
          />
          <div>
            <p className="mb-2.5 text-sm font-medium">Accent color</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(ACCENTS).map(([key, a]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => settings.update({ accent: key })}
                  className={`flex size-10 items-center justify-center rounded-full transition hover:scale-105 ${settings.accent === key ? "ring-2 ring-base-content/70 ring-offset-2 ring-offset-base-100" : ""}`}
                  style={{ background: a.swatch }}
                  aria-label={`${a.label} accent`}
                  aria-pressed={settings.accent === key}
                  title={a.label}
                >
                  {settings.accent === key && <Check className="size-4 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Chat bubbles">
        <div className="grid grid-cols-2 gap-3 p-4">
          {Object.entries(BUBBLE_STYLES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => settings.update({ bubbleStyle: key })}
              aria-pressed={settings.bubbleStyle === key}
              className={`overflow-hidden rounded-2xl border-2 text-left transition ${settings.bubbleStyle === key ? "border-primary" : "border-transparent hover:border-base-300"}`}
            >
              <BubblePreview style={key} />
              <span className="flex items-center justify-between bg-base-200/60 px-3 py-2 text-sm font-medium">
                {label}
                {settings.bubbleStyle === key && <Check className="size-4 text-primary" />}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Chat wallpaper">
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {Object.entries(WALLPAPERS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => settings.update({ wallpaper: key })}
              className={`overflow-hidden rounded-xl border-2 text-left transition ${settings.wallpaper === key ? "border-primary" : "border-transparent hover:border-base-300"}`}
              aria-pressed={settings.wallpaper === key}
            >
              <div className={`wallpaper-${key} flex h-20 flex-col justify-end gap-1 p-2`}>
                <span className="h-2.5 w-3/5 rounded-full bg-bubble-in shadow-sm" />
                <span className="ml-auto h-2.5 w-1/2 rounded-full bg-bubble-out" />
              </div>
              <span className="block bg-base-200/60 px-2 py-1.5 text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Text size">
        <div className="p-4">
          <Segmented value={settings.fontSize} onChange={(v) => settings.update({ fontSize: v })} options={Object.entries(FONT_SIZES).map(([value, label]) => ({ value, label: label === "Extra large" ? "XL" : label }))} />
        </div>
      </Card>
    </>
  );
}

// ---- Help ---------------------------------------------------------------------------------

const SHORTCUTS = [
  [`${modKey} K`, "Search chats, people and messages"],
  ["Esc", "Close the chat / cancel reply or edit"],
  ["↑", "Edit your last message"],
  ["Enter", "Send (Shift+Enter for a new line)"],
  ["@", "Mention someone in a group"],
];

function HelpSection() {
  const installable = useSyncExternalStore(subscribeInstall, canInstall, () => false);
  return (
    <>
      <Card title="Keyboard shortcuts">
        <ul className="divide-y divide-base-300/60">
          {SHORTCUTS.map(([keys, label]) => (
            <li key={keys} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-base-content/75">{label}</span>
              <span className="flex shrink-0 gap-1">
                {keys.split(" ").map((k) => (
                  <kbd key={k} className="kbd kbd-sm">
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="App">
        {installable && !isStandalone() && <LinkRow icon={Download} label="Install BlinkChat" description="Open it like an app, with its own icon and window." onClick={() => promptInstall()} />}
        {isIOS && !isStandalone() && !installable && (
          <LinkRow icon={Download} label="Add to Home Screen" description="In Safari, tap Share → Add to Home Screen for the app experience and notifications." onClick={() => {}} />
        )}
        <LinkRow icon={QrCode} label="My QR code" description="Let people start a chat with you" onClick={() => useUIStore.getState().open("shareProfile")} right={<Chevron />} />
        <div className="flex items-center justify-between px-4 py-3.5 text-sm text-base-content/55">
          <span>BlinkChat 2.1</span>
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
    </>
  );
}

function useSaveServer() {
  return async (patch) => {
    try {
      await useAuthStore.getState().updateProfile({ settings: patch });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
}

const RENDER = {
  profile: () => (
    <Suspense
      fallback={
        <div className="flex justify-center py-10">
          <Spinner className="size-6 text-base-content/40" />
        </div>
      }
    >
      <ProfileSection />
    </Suspense>
  ),
  account: () => <AccountSection />,
  privacy: () => <PrivacySection />,
  chats: () => <ChatsSection />,
  appearance: () => <AppearanceSection />,
  notifications: () => <NotificationsSection />,
  help: () => <HelpSection />,
};

// ---- Layout ---------------------------------------------------------------------------------

function SettingsMenu({ active }) {
  const me = useAuthStore((s) => s.authUser);
  const navigate = useNavigate();
  const wide = useIsWide();
  const go = (id) => {
    if (!wide) setNavDirection("forward");
    navigate(`/settings/${id}`, { viewTransition: true, replace: wide && Boolean(active) });
  };
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-base-100">
      <PanelHeader title="Settings" onBack={wide ? () => navigate("/chat", { viewTransition: true }) : undefined} backLabel="Back to chats" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-28 md:pb-4">
        <div className={`mb-2 flex items-center rounded-xl pr-1 transition ${active === "profile" ? "bg-primary/10 dark:bg-base-content/[0.08]" : "hover:bg-base-content/[0.04]"}`}>
          <button type="button" onClick={() => go("profile")} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left">
            <Avatar src={me.profilePic} name={me.fullName} seed={me._id} size={56} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[1.05rem] font-semibold">{me.fullName}</span>
              <span className="block truncate text-sm text-base-content/55">{me.status?.text ? `${me.status.emoji} ${me.status.text}` : me.about || "Add an about"}</span>
            </span>
          </button>
          <button type="button" onClick={() => useUIStore.getState().open("shareProfile")} className="icon-btn text-primary" aria-label="My QR code" title="My QR code">
            <QrCode className="size-5" />
          </button>
        </div>
        {SECTIONS.filter((s) => s.id !== "profile").map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            className={`anim-cascade flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition ${active === s.id ? "bg-primary/10 dark:bg-base-content/[0.08]" : "hover:bg-base-content/[0.04]"}`}
            style={{ "--i": i }}
          >
            <span className="flex size-10 shrink-0 items-center justify-center text-base-content/65">
              <s.icon className="size-[22px]" strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.975rem] font-medium">{s.label}</span>
              <span className="block truncate text-[0.8125rem] text-base-content/55">{s.hint}</span>
            </span>
            {!wide && <Chevron />}
          </button>
        ))}
        <div className="mx-2 my-2 h-px bg-base-300/70" />
        <button type="button" onClick={() => useAuthStore.getState().logout()} className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-error transition hover:bg-error/[0.06]">
          <span className="flex size-10 shrink-0 items-center justify-center">
            <LogOut className="size-[22px]" strokeWidth={1.9} />
          </span>
          <span className="text-[0.975rem] font-medium">Log out</span>
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const wide = useIsWide();
  if (section && !RENDER[section]) return <Navigate to="/settings" replace />;
  const current = section || (wide ? "profile" : null);
  const meta = SECTIONS.find((s) => s.id === current);

  return (
    <SplitView
      showDetail={Boolean(section)}
      list={<SettingsMenu active={current} />}
      detail={
        current ? (
          <SectionShell
            key={current}
            title={meta.label}
            onBack={
              wide
                ? undefined
                : () => {
                    setNavDirection("back");
                    navigate("/settings", { viewTransition: true });
                  }
            }
            backLabel="Back to settings"
          >
            {RENDER[current]()}
          </SectionShell>
        ) : null
      }
    />
  );
}
