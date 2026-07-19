import { CheckCheck, Bell } from "lucide-react";
import { getInitials, getMessagePreview, formatRelativeTime } from "../lib/utils";

/**
 * Presentational notification list. `onSelect` is called with the user
 * when a notification is tapped; `onMarkAllRead` clears every unread
 * badge at once. Used inside a popover on desktop and a bottom sheet
 * on mobile so the two surfaces share the exact same behavior.
 */
const NotificationList = ({ notifications, onSelect, onMarkAllRead }) => (
  <>
    <div className="px-4 py-3 border-b border-base-300 flex items-center justify-between">
      <span className="font-semibold text-sm">Notifications</span>
      {notifications.length > 0 && (
        <button
          onClick={onMarkAllRead}
          className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
        >
          <CheckCheck className="size-3.5" /> Mark all read
        </button>
      )}
    </div>
    {notifications.length === 0 ? (
      <div className="px-4 py-10 text-center text-sm text-base-content/50 flex flex-col items-center gap-2">
        <div className="size-12 rounded-2xl bg-base-200 flex items-center justify-center">
          <Bell className="size-5 opacity-40" />
        </div>
        You're all caught up!
      </div>
    ) : (
      notifications.map(({ user, count, lastMessage }) => (
        <button
          key={user._id}
          onClick={() => onSelect(user)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-base-200 text-left border-b border-base-300 last:border-0"
        >
          <div className="relative shrink-0">
            {user.profilePic ? (
              <img src={user.profilePic} alt="" className="size-10 rounded-full object-cover" />
            ) : (
              <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold">
                {getInitials(user.fullName)}
              </div>
            )}
            <span className="absolute -top-1 -right-1 size-4 rounded-full bg-brand-pink ring-2 ring-base-100" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{user.fullName}</p>
            <p className="text-xs text-base-content/60 truncate">
              {getMessagePreview(lastMessage)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] text-base-content/40">
              {lastMessage ? formatRelativeTime(lastMessage.createdAt) : ""}
            </span>
            <span className="badge badge-primary badge-sm">{count}</span>
          </div>
        </button>
      ))
    )}
  </>
);

export default NotificationList;
