import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users } from "lucide-react";

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const filteredUsers = (showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users
  ).slice(0,3);
  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200 bg-base-100">
      <div className="border-b border-base-300 w-full p-5 sticky top-0 bg-base-100 z-10">
        <div className="flex items-center gap-2">
          <Users className="size-6 text-primary" />
          <span className="font-medium hidden lg:block text-lg">Contacts</span>
        </div>
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm accent-primary"
              aria-label="Show online only"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">
            ({Math.max(onlineUsers.length - 1, 0)} online)
          </span>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3 flex-1">
        {filteredUsers.length === 0 ? (
          <div className="text-center text-zinc-500 py-8 flex flex-col items-center justify-center">
            <Users className="size-8 mb-2" />
            <span className="text-base font-medium">
              {showOnlineOnly
                ? "No users are online right now."
                : "No contacts found."}
            </span>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isOnline = onlineUsers.includes(user._id);
            const isSelected = selectedUser?._id === user._id;
            return (
              <button
                key={user._id}
                onClick={() => setSelectedUser(user)}
                className={`
                  w-full p-3 flex items-center gap-3 group
                  transition-colors rounded-lg
                  ${isSelected
                    ? "bg-primary/10 ring-2 ring-primary"
                    : "hover:bg-base-200"}
                  focus:outline-none focus:ring-2 focus:ring-primary
                `}
                aria-selected={isSelected}
                tabIndex={0}
              >
                <div className="relative mx-auto lg:mx-0">
                  {user.profilePic ? (
                    <img
                      src={user.profilePic}
                      alt={user.fullName}
                      className="size-12 object-cover rounded-full border border-base-300"
                    />
                  ) : (
                    <div className="size-12 flex items-center justify-center rounded-full bg-base-300 text-base-content font-bold text-lg border border-base-300">
                      {getInitials(user.fullName)}
                    </div>
                  )}
                  {isOnline && (
                    <span
                      className="absolute bottom-0 right-0 size-3 bg-green-500 
                        rounded-full ring-2 ring-base-100 animate-pulse"
                      title="Online"
                    />
                  )}
                </div>
                <div className="hidden lg:block text-left min-w-0">
                  <div className="font-medium truncate">{user.fullName}</div>
                  <div className={`text-sm ${isOnline ? "text-green-600" : "text-zinc-400"}`}>
                    {isOnline ? "Online" : "Offline"}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
