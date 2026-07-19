import { useEffect, useState, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Search, Users, X } from "lucide-react";
import { getInitials, getMessagePreview, formatRelativeTime } from "../lib/utils";

const Sidebar = ({ expanded = false }) => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    unreadCounts,
    lastMessages,
    typingUsers,
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const filteredUsers = useMemo(() => {
    let result = showOnlineOnly
      ? users.filter((user) => onlineUsers.includes(user._id))
      : users;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((user) =>
        user.fullName.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
      const aTime = lastMessages[a._id]?.createdAt;
      const bTime = lastMessages[b._id]?.createdAt;
      if (aTime && bTime) return new Date(bTime) - new Date(aTime);
      if (aTime) return -1;
      if (bTime) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [users, showOnlineOnly, onlineUsers, searchQuery, lastMessages]);

  const onlineCount = Math.max(
    onlineUsers.filter((id) => id !== authUser?._id).length,
    0
  );

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className={`h-full ${expanded ? "w-full" : "w-20"} lg:w-80 border-r border-base-300/80 flex flex-col bg-base-100/95 backdrop-blur-sm`}>
      <div className="border-b border-base-300/80 p-4 lg:p-5 sticky top-0 bg-base-100/95 backdrop-blur-md z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="size-4 text-primary" />
            </div>
            <span className={`font-bold text-lg tracking-tight ${expanded ? "block" : "hidden lg:block"}`}>
              Messages
            </span>
          </div>
          <span className="hidden lg:inline-flex badge badge-primary badge-sm font-medium">
            {onlineCount} online
          </span>
        </div>

        <div className={`relative ${expanded ? "block" : "hidden lg:block"}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-sm input-bordered w-full pl-9 pr-8 bg-base-200/50 border-base-300/80 focus:border-primary"
            aria-label="Search contacts"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <label className={`${expanded ? "flex" : "hidden lg:flex"} items-center gap-2 cursor-pointer`}>
          <input
            type="checkbox"
            checked={showOnlineOnly}
            onChange={(e) => setShowOnlineOnly(e.target.checked)}
            className="toggle toggle-primary toggle-sm"
            aria-label="Show online only"
          />
          <span className="text-sm text-base-content/70">Online only</span>
        </label>
      </div>

      <div className="overflow-y-auto flex-1 py-2 px-2 lg:px-3 scrollbar-thin">
        {filteredUsers.length === 0 ? (
          <div className="text-center text-base-content/50 py-12 flex flex-col items-center gap-3 px-4">
            <div className="size-14 rounded-2xl bg-base-200 flex items-center justify-center">
              <Users className="size-7 opacity-50" />
            </div>
            <span className="text-sm font-medium">
              {searchQuery
                ? "No contacts match your search"
                : showOnlineOnly
                  ? "No one is online right now"
                  : "No contacts found"}
            </span>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isOnline = onlineUsers.includes(user._id);
            const isSelected = selectedUser?._id === user._id;
            const unread = unreadCounts[user._id] || 0;
            const lastMsg = lastMessages[user._id];
            const isTyping = typingUsers[user._id];
            const preview = isTyping
              ? "typing..."
              : getMessagePreview(lastMsg);

            return (
              <button
                key={user._id}
                onClick={() => setSelectedUser(user)}
                className={`
                  w-full p-2.5 lg:p-3 flex items-center gap-3 rounded-xl mb-1
                  transition-all duration-200 group
                  ${isSelected
                    ? "bg-primary/15 shadow-sm ring-1 ring-primary/30"
                    : "hover:bg-base-200/80"}
                  focus:outline-none focus:ring-2 focus:ring-primary/50
                `}
                aria-selected={isSelected}
              >
                <div className="relative shrink-0 mx-auto lg:mx-0">
                  {user.profilePic ? (
                    <img
                      src={user.profilePic}
                      alt={user.fullName}
                      className="size-11 lg:size-12 object-cover rounded-full ring-2 ring-base-300/50"
                    />
                  ) : (
                    <div className="size-11 lg:size-12 flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 font-bold text-sm ring-2 ring-base-300/50">
                      {getInitials(user.fullName)}
                    </div>
                  )}
                  {isOnline && (
                    <span
                      className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full ring-2 ring-base-100"
                      title="Online"
                    />
                  )}
                </div>

                <div className={`${expanded ? "block" : "hidden lg:block"} text-left min-w-0 flex-1`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate text-sm">
                      {user.fullName}
                    </span>
                    {lastMsg && (
                      <span className="text-[10px] text-base-content/40 shrink-0">
                        {formatRelativeTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className={`text-xs truncate ${
                        isTyping
                          ? "text-primary font-medium italic"
                          : unread > 0
                            ? "text-base-content font-medium"
                            : "text-base-content/50"
                      }`}
                    >
                      {preview}
                    </p>
                    {unread > 0 && (
                      <span className="badge badge-primary badge-sm min-w-[1.25rem] shrink-0">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
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
