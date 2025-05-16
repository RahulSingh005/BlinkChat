import { X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(selectedUser._id);

  return (
    <div className="p-3 border-b border-base-300 bg-base-100 sticky top-0 z-10">
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={selectedUser.profilePic || "/avatar.png"}
              alt={selectedUser.fullName}
              className="size-11 rounded-full border border-base-300 object-cover"
            />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-base-100
                ${isOnline ? "bg-green-500 animate-pulse" : "bg-zinc-400"}
              `}
              title={isOnline ? "Online" : "Offline"}
            />
          </div>
          <div>
            <h3 className="font-semibold text-base-content truncate max-w-[120px] sm:max-w-xs">
              {selectedUser.fullName}
            </h3>
            <p className={`text-xs ${isOnline ? "text-green-600" : "text-zinc-400"}`}>
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setSelectedUser(null)}
          className="btn btn-ghost btn-sm rounded-full hover:bg-base-200 transition-colors focus:ring-2 focus:ring-primary"
          aria-label="Close chat"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
