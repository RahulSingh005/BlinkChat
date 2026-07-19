import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import {
  MessageSquare,
  Settings,
  User,
  LogOut,
  LayoutDashboard,
  Bell,
} from "lucide-react";
import { getAvatarUrl, getInitials } from "../lib/utils";

const NAV_ITEMS = [
  { to: "/chat", icon: LayoutDashboard, label: "Dashboard", exact: false },
  { to: "/chat", icon: MessageSquare, label: "Messages", exact: false, badge: true },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const DashboardNav = () => {
  const { authUser, logout } = useAuthStore();
  const totalUnread = useChatStore((s) => s.getTotalUnread());
  const location = useLocation();

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

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/30 cursor-not-allowed">
          <Bell className="size-5 shrink-0" />
          <span className="hidden lg:block text-sm">Notifications</span>
        </div>
      </nav>

      {/* User card */}
      <div className="p-3 lg:p-4 mt-auto">
        <div className="bg-white rounded-2xl p-3 hidden lg:block shadow-card">
          <div className="flex items-center gap-3">
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
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-neutral text-sm truncate">{authUser?.fullName}</p>
              <span className="inline-block text-[10px] bg-neutral text-white px-2 py-0.5 rounded-full font-medium mt-0.5">
                Member
              </span>
            </div>
            <button
              onClick={logout}
              className="text-neutral/40 hover:text-error transition-colors"
              aria-label="Logout"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>

        {/* Mobile nav footer icons */}
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
