import { NavLink } from "react-router-dom";
import { AlarmClock, MessageSquare, Moon, Settings, Sun } from "lucide-react";
import Avatar from "../ui/Avatar";
import { LogoMark } from "../ui/Logo";
import { revealThemeChange } from "../../lib/transitions";
import { useAuthStore } from "../../store/useAuthStore";
import { selectTotalUnread, useChatStore } from "../../store/useChatStore";
import { selectDueCount, useReminderStore } from "../../store/useReminderStore";
import { useSettingsStore } from "../../store/useSettingsStore";

const Badge = ({ count, tone = "primary" }) =>
  count > 0 ? (
    <span
      key={count}
      className={`anim-bump absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ring-rail ${
        tone === "warning" ? "bg-warning text-warning-content" : "bg-primary text-primary-content"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

function RailLink({ to, label, icon: Icon, badge, tone }) {
  return (
    <NavLink
      to={to}
      viewTransition
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        `group relative flex size-11 items-center justify-center rounded-2xl transition ${
          isActive ? "bg-white/[0.12] text-white" : "text-white/55 hover:bg-white/[0.07] hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-white" />}
          <span className="relative">
            <Icon className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.9} />
            <Badge count={badge} tone={tone} />
          </span>
        </>
      )}
    </NavLink>
  );
}

export default function NavRail() {
  const user = useAuthStore((s) => s.authUser);
  const unread = useChatStore(selectTotalUnread);
  const due = useReminderStore(selectDueCount);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);
  const dark = resolvedTheme === "blinkdark";

  const toggleTheme = (e) => {
    const next = dark ? "light" : "dark";
    revealThemeChange(() => useSettingsStore.getState().update({ theme: next }), e.clientX, e.clientY);
  };

  return (
    <nav className="safe-top hidden w-[72px] shrink-0 flex-col items-center bg-rail py-4 md:flex" aria-label="Main">
      <NavLink to="/chat" viewTransition className="mb-6" aria-label="BlinkChat home">
        <LogoMark size={38} />
      </NavLink>
      <div className="flex flex-1 flex-col items-center gap-2">
        <RailLink to="/chat" label="Chats" icon={MessageSquare} badge={unread} />
        <RailLink to="/reminders" label="Reminders" icon={AlarmClock} badge={due} tone="warning" />
        <RailLink to="/settings" label="Settings" icon={Settings} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex size-11 items-center justify-center rounded-2xl text-white/55 transition hover:bg-white/[0.07] hover:text-white"
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          title={dark ? "Light theme" : "Dark theme"}
        >
          {dark ? <Sun className="size-[21px]" /> : <Moon className="size-[21px]" />}
        </button>
        <NavLink to="/profile" viewTransition aria-label="Your profile" title="Profile" className="rounded-full ring-2 ring-transparent transition hover:ring-white/30">
          <Avatar src={user?.profilePic} name={user?.fullName} seed={user?._id} size={38} />
        </NavLink>
      </div>
    </nav>
  );
}
