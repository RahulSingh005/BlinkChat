import { NavLink } from "react-router-dom";
import { AlarmClock, MessageSquare, Settings } from "lucide-react";
import Avatar from "../ui/Avatar";
import { useAuthStore } from "../../store/useAuthStore";
import { selectTotalUnread, useChatStore } from "../../store/useChatStore";
import { selectDueCount, useReminderStore } from "../../store/useReminderStore";

function Tab({ to, label, icon: Icon, badge, children }) {
  return (
    <NavLink
      to={to}
      viewTransition
      className={({ isActive }) =>
        `relative flex flex-1 flex-col items-center justify-center gap-1 pb-1 pt-2 text-[11px] font-medium transition-colors ${
          isActive ? "text-primary" : "text-base-content/55"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative flex h-7 w-14 items-center justify-center rounded-full transition-colors ${isActive ? "bg-primary/10" : ""}`}>
            {children || <Icon className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.9} />}
            {badge > 0 && (
              <span
                key={badge}
                className="anim-bump absolute -top-1 right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-content ring-2 ring-base-100"
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

/** Phone tab bar (hidden on md+ where the NavRail is used). */
export default function BottomNav() {
  const user = useAuthStore((s) => s.authUser);
  const unread = useChatStore(selectTotalUnread);
  const due = useReminderStore(selectDueCount);

  return (
    <nav className="safe-bottom shrink-0 border-t border-base-300/70 bg-base-100/95 backdrop-blur md:hidden" aria-label="Main">
      <div className="flex h-14">
        <Tab to="/chat" label="Chats" icon={MessageSquare} badge={unread} />
        <Tab to="/reminders" label="Reminders" icon={AlarmClock} badge={due} />
        <Tab to="/settings" label="Settings" icon={Settings} />
        <Tab to="/profile" label="You">
          <Avatar src={user?.profilePic} name={user?.fullName} seed={user?._id} size={24} />
        </Tab>
      </div>
    </nav>
  );
}
