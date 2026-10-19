import { NavLink } from "react-router-dom";
import { AlarmClock, CircleDashed, MessageCircle, Moon, Phone, Settings, Star, Sun } from "lucide-react";
import Avatar from "../ui/Avatar";
import { LogoMark } from "../ui/Logo";
import { revealThemeChange } from "../../lib/transitions";
import { useAuthStore } from "../../store/useAuthStore";
import { selectMissedCount, useCallLogStore } from "../../store/useCallLogStore";
import { selectTotalUnread, useChatStore } from "../../store/useChatStore";
import { selectDueCount, useReminderStore } from "../../store/useReminderStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { selectUnseenStories, useStoryStore } from "../../store/useStoryStore";

export function NavBadge({ count, dot = false, tone = "primary", ring = "ring-rail" }) {
  if (dot) return count > 0 ? <span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ${ring}`} /> : null;
  if (!count) return null;
  return (
    <span
      key={count}
      className={`anim-bump absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ${ring} ${
        tone === "warning" ? "bg-warning text-warning-content" : tone === "error" ? "bg-error text-error-content" : "bg-primary text-primary-content"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function RailLink({ to, label, icon: Icon, badge, dot, tone, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      viewTransition
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        `group relative flex size-11 items-center justify-center rounded-2xl transition-colors ${
          isActive ? "bg-primary/[0.12] text-primary dark:bg-base-content/[0.09] dark:text-base-content" : "text-base-content/55 hover:bg-base-content/[0.05] hover:text-base-content"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="anim-scale-in absolute -left-3.5 h-5 w-1 rounded-r-full bg-primary" />}
          <span className="relative">
            <Icon className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.85} />
            <NavBadge count={badge} dot={dot} tone={tone} />
          </span>
        </>
      )}
    </NavLink>
  );
}

/** Desktop/tablet navigation rail (WhatsApp/Telegram desktop style). */
export default function NavRail() {
  const user = useAuthStore((s) => s.authUser);
  const unread = useChatStore(selectTotalUnread);
  const due = useReminderStore(selectDueCount);
  const unseen = useStoryStore(selectUnseenStories);
  const missed = useCallLogStore(selectMissedCount);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);
  const dark = resolvedTheme === "blinkdark";

  const toggleTheme = (e) => {
    const next = dark ? "light" : "dark";
    revealThemeChange(() => useSettingsStore.getState().update({ theme: next }), e.clientX, e.clientY);
  };

  return (
    <nav className="safe-top hidden w-[68px] shrink-0 flex-col items-center border-r border-base-300/70 bg-rail py-3 md:flex" aria-label="Main">
      <NavLink to="/chat" viewTransition className="mb-4 rounded-2xl transition active:scale-95" aria-label="BlinkChat home">
        <LogoMark size={36} />
      </NavLink>
      <div className="flex flex-1 flex-col items-center gap-1.5">
        <RailLink to="/chat" label="Chats" icon={MessageCircle} badge={unread} />
        <RailLink to="/updates" label="Updates" icon={CircleDashed} badge={unseen} dot />
        <RailLink to="/calls" label="Calls" icon={Phone} badge={missed} tone="error" />
        <RailLink to="/reminders" label="Reminders" icon={AlarmClock} badge={due} tone="warning" />
        <RailLink to="/starred" label="Starred messages" icon={Star} />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex size-11 items-center justify-center rounded-2xl text-base-content/55 transition-colors hover:bg-base-content/[0.05] hover:text-base-content"
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          title={dark ? "Light theme" : "Dark theme"}
        >
          {dark ? <Sun className="size-[21px]" /> : <Moon className="size-[21px]" />}
        </button>
        <RailLink to="/settings" label="Settings" icon={Settings} />
        <NavLink
          to="/settings/profile"
          viewTransition
          aria-label="Your profile"
          title="Profile"
          className={({ isActive }) => `mt-1 rounded-full ring-2 transition ${isActive ? "ring-primary" : "ring-transparent hover:ring-base-content/20"}`}
        >
          <Avatar src={user?.profilePic} name={user?.fullName} seed={user?._id} size={36} />
        </NavLink>
      </div>
    </nav>
  );
}
