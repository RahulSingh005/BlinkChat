import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, MessageSquare, Settings, User } from "lucide-react";

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

const Navbar = () => {
  const { logout, authUser } = useAuthStore();

  return (
    <header
      className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40
        backdrop-blur-lg bg-base-100/80 shadow-md"
      role="navigation"
      aria-label="Main"
    >
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">

          <Link
            to="/"
            className="flex items-center gap-2.5 hover:opacity-80 transition-all"
            aria-label="BlinkChat Home"
          >
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">BlinkChat</h1>
          </Link>


          <nav className="flex items-center gap-2" aria-label="User actions">
            <Link
              to="/settings"
              className="btn btn-sm gap-2 transition-colors hover:bg-base-200 focus:ring-2 focus:ring-primary"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            {authUser && (
              <>
                <Link
                  to="/profile"
                  className="btn btn-sm gap-2 transition-colors hover:bg-base-200 focus:ring-2 focus:ring-primary"
                  aria-label="Profile"
                >
                  {authUser.profilePic ? (
                    <img
                      src={authUser.profilePic}
                      alt={authUser.fullName}
                      className="size-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="size-5 rounded-full bg-base-300 flex items-center justify-center font-bold text-xs text-base-content">
                      {getInitials(authUser.fullName)}
                    </span>
                  )}
                  <span className="hidden sm:inline">Profile</span>
                </Link>

                <button
                  className="btn btn-sm gap-2 bg-transparent hover:bg-error/10 text-error border-none transition-colors focus:ring-2 focus:ring-error"
                  onClick={logout}
                  aria-label="Logout"
                  tabIndex={0}
                >
                  <LogOut className="size-5" />
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
