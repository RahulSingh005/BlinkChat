import { NavLink } from "react-router-dom";
import { AlarmClock, CircleDashed, MessageCircle, Phone, Settings } from "lucide-react";
import { NavBadge } from "./NavRail";
import { selectMissedCount, useCallLogStore } from "../../store/useCallLogStore";
import { selectTotalUnread, useChatStore } from "../../store/useChatStore";
import { selectDueCount, useReminderStore } from "../../store/useReminderStore";
import { selectUnseenStories, useStoryStore } from "../../store/useStoryStore";

function Tab({ to, label, icon: Icon, badge, dot, tone }) {
  return (
    <NavLink
      to={to}
      viewTransition
      className={({ isActive }) =>
        `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pb-1 pt-2 text-[11px] font-medium transition-colors ${
          isActive ? "text-base-content" : "text-base-content/55"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200 ${isActive ? "bg-primary/15 text-primary" : ""}`}>
            <Icon className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.85} />
            <span className="absolute right-3 top-0.5">
              <NavBadge count={badge} dot={dot} tone={tone} ring="ring-base-100" />
            </span>
          </span>
          <span className="max-w-full truncate px-1">{label}</span>
        </>
      )}
    </NavLink>
  );
}

/** Phone tab bar (hidden on md+ where the NavRail is used). */
export default function BottomNav() {
  const unread = useChatStore(selectTotalUnread);
  const due = useReminderStore(selectDueCount);
  const unseen = useStoryStore(selectUnseenStories);
  const missed = useCallLogStore(selectMissedCount);

  return (
    <nav className="safe-bottom shrink-0 border-t border-base-300/70 bg-base-100 md:hidden" aria-label="Main">
      <div className="flex h-[58px]">
        <Tab to="/chat" label="Chats" icon={MessageCircle} badge={unread} />
        <Tab to="/updates" label="Updates" icon={CircleDashed} badge={unseen} dot />
        <Tab to="/calls" label="Calls" icon={Phone} badge={missed} tone="error" />
        <Tab to="/reminders" label="Reminders" icon={AlarmClock} badge={due} tone="warning" />
        <Tab to="/settings" label="Settings" icon={Settings} />
      </div>
    </nav>
  );
}
