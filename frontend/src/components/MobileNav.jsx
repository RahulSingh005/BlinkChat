import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Settings, LogOut, Bell } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { getAvatarUrl } from "../lib/utils";
import { useNotifications } from "../hooks/useNotifications";
import NotificationList from "./NotificationList";

const MobileNav = () => {
  const { authUser, logout } = useAuthStore();
  const { totalUnread, notifications, markAllAsRead, openNotification } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const isActive = (path) => location.pathname === path;

  const itemClass = (active) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors relative
     ${active ? "text-primary" : "text-base-content/50"}`;

  return (
    <nav
      className="md:hidden shrink-0 h-16 bg-base-100 border-t border-base-300 flex items-stretch relative z-40"
      aria-label="Mobile navigation"
    >
      <Link to="/chat" className={itemClass(isActive("/chat"))}>
        <MessageSquare className="size-5" />
        Chats
        {totalUnread > 0 && (
          <span className="absolute top-1.5 right-[28%] size-4 rounded-full bg-brand-pink text-white text-[9px] font-bold flex items-center justify-center">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </Link>

      <button
        onClick={() => setShowNotifications((v) => !v)}
        className={itemClass(showNotifications)}
        aria-label="Notifications"
        aria-expanded={showNotifications}
      >
        <Bell className="size-5" />
        Alerts
        {totalUnread > 0 && (
          <span className="absolute top-1.5 right-[28%] size-4 rounded-full bg-brand-pink text-white text-[9px] font-bold flex items-center justify-center">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      <Link to="/settings" className={itemClass(isActive("/settings"))}>
        <Settings className="size-5" />
        Settings
      </Link>

      <Link to="/profile" className={itemClass(isActive("/profile"))}>
        <img
          src={getAvatarUrl(authUser)}
          alt=""
          className={`size-5 rounded-full object-cover ${
            isActive("/profile") ? "ring-2 ring-primary" : ""
          }`}
        />
        Profile
      </Link>

      <button onClick={logout} className={itemClass(false)} aria-label="Logout">
        <LogOut className="size-5" />
        Logout
      </button>

      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowNotifications(false)}
            aria-hidden="true"
          />
          <div className="absolute z-40 right-2 bottom-full mb-2 w-[calc(100vw-1rem)] max-w-sm max-h-96 overflow-y-auto bg-base-100 text-base-content rounded-2xl shadow-2xl border border-base-300 animate-scale-in">
            <NotificationList
              notifications={notifications}
              onMarkAllRead={markAllAsRead}
              onSelect={(user) => {
                openNotification(user);
                setShowNotifications(false);
                navigate("/chat");
              }}
            />
          </div>
        </>
      )}
    </nav>
  );
};

export default MobileNav;
