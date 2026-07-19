import { ArrowLeft, MoreVertical, Phone, Video, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { getInitials } from "../lib/utils";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, typingUsers } = useChatStore();
  const { onlineUsers } = useAuthStore();

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(selectedUser._id);
  const isTyping = typingUsers[selectedUser._id];

  return (
    <div className="px-3 py-3 lg:px-5 border-b border-base-300/80 bg-base-100/95 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSelectedUser(null)}
            className="btn btn-ghost btn-sm btn-circle lg:hidden shrink-0"
            aria-label="Back to contacts"
          >
            <ArrowLeft className="size-5" />
          </button>

          <div className="relative shrink-0">
            {selectedUser.profilePic ? (
              <img
                src={selectedUser.profilePic}
                alt={selectedUser.fullName}
                className="size-11 rounded-full ring-2 ring-primary/20 object-cover"
              />
            ) : (
              <div className="size-11 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center font-bold text-sm ring-2 ring-primary/20">
                {getInitials(selectedUser.fullName)}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-base-100
                ${isOnline ? "bg-emerald-500" : "bg-base-content/30"}
              `}
            />
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-base truncate">
              {selectedUser.fullName}
            </h3>
            <p
              className={`text-xs truncate ${
                isTyping
                  ? "text-primary font-medium"
                  : isOnline
                    ? "text-emerald-500"
                    : "text-base-content/50"
              }`}
            >
              {isTyping ? "typing..." : isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            className="btn btn-ghost btn-sm btn-circle hidden sm:flex opacity-60 cursor-not-allowed"
            aria-label="Voice call (coming soon)"
            title="Coming soon"
          >
            <Phone className="size-4" />
          </button>
          <button
            className="btn btn-ghost btn-sm btn-circle hidden sm:flex opacity-60 cursor-not-allowed"
            aria-label="Video call (coming soon)"
            title="Coming soon"
          >
            <Video className="size-4" />
          </button>
          <button
            className="btn btn-ghost btn-sm btn-circle hidden lg:flex"
            aria-label="More options"
          >
            <MoreVertical className="size-4" />
          </button>
          <button
            onClick={() => setSelectedUser(null)}
            className="btn btn-ghost btn-sm btn-circle hidden lg:flex hover:bg-error/10 hover:text-error"
            aria-label="Close chat"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
