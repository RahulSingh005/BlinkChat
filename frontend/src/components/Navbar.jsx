import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { LogOut, MessageSquare, Settings, User } from "lucide-react";
import { getInitials } from "../lib/utils";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const totalUnread = useChatStore((s) => s.getTotalUnread());

  return (
    <header
      className="bg-base-100/80 border-b border-base-300/60 fixed w-full top-0 z-40 backdrop-blur-xl"
      role="navigation"
      aria-label="Main"
    >
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-90 transition-opacity group"
            aria-label="BlinkChat Home"
          >
            <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
              <MessageSquare className="w-5 h-5 text-primary-content" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-extrabold tracking-tight leading-none">
                BlinkChat
              </h1>
              <span className="text-[10px] text-base-content/40 font-medium hidden sm:block">
                Connect instantly
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5" aria-label="User actions">
            {authUser && totalUnread > 0 && (
              <span className="badge badge-primary badge-sm mr-1 hidden sm:flex">
                {totalUnread} unread
              </span>
            )}

            <Link
              to="/settings"
              className="btn btn-ghost btn-sm gap-2 rounded-xl"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            {authUser && (
              <>
                <Link
                  to="/profile"
                  className="btn btn-ghost btn-sm gap-2 rounded-xl"
                  aria-label="Profile"
                >
                  {authUser.profilePic ? (
                    <img
                      src={authUser.profilePic}
                      alt={authUser.fullName}
                      className="size-6 rounded-full object-cover ring-2 ring-primary/20"
                    />
                  ) : (
                    <span className="size-6 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center font-bold text-[10px]">
                      {getInitials(authUser.fullName)}
                    </span>
                  )}
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {authUser.fullName.split(" ")[0]}
                  </span>
                </Link>

                <button
                  className="btn btn-ghost btn-sm gap-2 text-error hover:bg-error/10 rounded-xl"
                  onClick={logout}
                  aria-label="Logout"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
