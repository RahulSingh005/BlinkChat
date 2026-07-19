import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  MessageSquare,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";
import { getAvatarUrl, getInitials } from "../lib/utils";
import { useNotifications } from "../hooks/useNotifications";
import NotificationList from "./NotificationList";

// Only one entry point into the chat list — having both "Dashboard" and
// "Messages" link to the same /chat route was confusing and redundant.
const NAV_ITEMS = [{ to: "/chat", icon: MessageSquare, label: "Messages", badge: true }];

const DashboardNav = () => {
  const { authUser, logout } = useAuthStore();
  const { totalUnread, notifications, markAllAsRead, openNotification } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="hidden md:flex flex-col w-[72px] lg:w-[220px] bg-brand-dark-sidebar text-white shrink-0 h-full">
      {/* Logo */}
      <div className="p-4 lg:px-5 lg:py-6 flex items-center gap-3">
        <div className="size-9 rounded-xl bg-brand-pink flex items-center justify-center shrink-0">
          <MessageSquare className="size-5 text-white" />
        </div>
        <span className="font-bold text-lg hidden lg:block tracking-tight">BlinkChat</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 lg:px-3 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => {
          const active = isActive(to) || (to === "/chat" && location.pathname.startsWith("/chat"));
          return (
            <Link
              key={label}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative
                ${active
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
            >
              <Icon className="size-5 shrink-0" />
              <span className="hidden lg:block text-sm font-medium">{label}</span>
              {badge && totalUnread > 0 && (
                <span className="absolute top-1.5 left-7 lg:left-auto lg:right-3 size-5 rounded-full bg-brand-pink text-[10px] font-bold flex items-center justify-center">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </Link>
          );
        })}

        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
            ${isActive("/settings") ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
        >
          <Settings className="size-5 shrink-0" />
          <span className="hidden lg:block text-sm font-medium">Settings</span>
        </Link>

        <div className="relative">
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all relative"
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
            <Bell className="size-5 shrink-0" />
            <span className="hidden lg:block text-sm">Notifications</span>
            {totalUnread > 0 && (
              <span className="absolute top-1.5 left-7 lg:left-auto lg:right-3 size-5 rounded-full bg-brand-pink text-[10px] font-bold flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowNotifications(false)}
                aria-hidden="true"
              />
              <div className="absolute z-40 left-0 lg:left-2 bottom-full mb-2 w-72 max-h-80 overflow-y-auto bg-base-100 text-base-content rounded-2xl shadow-2xl border border-base-300 animate-scale-in">
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
        </div>
      </nav>

      {/* User card */}
      <div className="p-3 lg:p-4 mt-auto">
        <div className="bg-white rounded-2xl p-3 hidden lg:block shadow-card">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="shrink-0">
              {authUser?.profilePic ? (
                <img
                  src={getAvatarUrl(authUser)}
                  alt={authUser.fullName}
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <div className="size-10 rounded-full bg-brand-lavender flex items-center justify-center text-brand-purple font-bold text-sm">
                  {getInitials(authUser?.fullName)}
                </div>
              )}
            </Link>
            <Link to="/profile" className="flex-1 min-w-0">
              <p className="font-semibold text-neutral text-sm truncate">{authUser?.fullName}</p>
              <span className="inline-block text-[10px] bg-neutral text-white px-2 py-0.5 rounded-full font-medium mt-0.5">
                Member
              </span>
            </Link>
            <button
              onClick={logout}
              className="text-neutral/40 hover:text-error transition-colors"
              aria-label="Logout"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>

        {/* Compact rail (md-lg): avatar + logout only */}
        <div className="flex lg:hidden flex-col items-center gap-3 py-2">
          <Link to="/profile" className="size-10 rounded-full overflow-hidden ring-2 ring-white/20">
            <img src={getAvatarUrl(authUser)} alt="" className="size-full object-cover" />
          </Link>
          <button onClick={logout} className="text-white/40 hover:text-white" aria-label="Logout">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DashboardNav;
