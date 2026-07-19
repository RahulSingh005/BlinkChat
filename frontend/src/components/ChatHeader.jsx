import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Info,
  MoreVertical,
  Phone,
  ShieldCheck,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { getInitials, formatDate } from "../lib/utils";
import toast from "react-hot-toast";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, typingUsers, clearChatWith, toggleBlockUser } =
    useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const { startCall, callStatus } = useCallStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close the menu whenever the conversation changes.
  useEffect(() => {
    setShowMenu(false);
  }, [selectedUser?._id]);

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(selectedUser._id);
  const isTyping = typingUsers[selectedUser._id];
  const isBlocked = authUser?.blockedUsers?.some(
    (id) => String(id) === String(selectedUser._id)
  );

  const handleClearChat = async () => {
    setShowMenu(false);
    if (!window.confirm(`Clear all messages with ${selectedUser.fullName}? This can't be undone.`)) {
      return;
    }
    await clearChatWith(selectedUser._id);
  };

  const handleToggleBlock = async () => {
    setShowMenu(false);
    const verb = isBlocked ? "unblock" : "block";
    if (!window.confirm(`Are you sure you want to ${verb} ${selectedUser.fullName}?`)) return;
    await toggleBlockUser(selectedUser._id);
  };

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

          <button
            className="relative shrink-0"
            onClick={() => setShowInfo(true)}
            aria-label="View contact info"
          >
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
          </button>

          <button
            className="min-w-0 text-left"
            onClick={() => setShowInfo(true)}
            aria-label="View contact info"
          >
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
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (isBlocked) return toast.error(`Unblock ${selectedUser.fullName} to call them`);
              if (!isOnline) return toast.error(`${selectedUser.fullName} is offline`);
              if (callStatus !== "idle") return toast.error("You're already on a call");
              startCall(selectedUser, "voice");
            }}
            className="btn btn-ghost btn-sm btn-circle flex hover:bg-primary/10 hover:text-primary"
            aria-label="Start voice call"
            title="Voice call"
          >
            <Phone className="size-4" />
          </button>
          <button
            onClick={() => {
              if (isBlocked) return toast.error(`Unblock ${selectedUser.fullName} to call them`);
              if (!isOnline) return toast.error(`${selectedUser.fullName} is offline`);
              if (callStatus !== "idle") return toast.error("You're already on a call");
              startCall(selectedUser, "video");
            }}
            className="btn btn-ghost btn-sm btn-circle flex hover:bg-primary/10 hover:text-primary"
            aria-label="Start video call"
            title="Video call"
          >
            <Video className="size-4" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="btn btn-ghost btn-sm btn-circle flex"
              aria-label="More options"
              aria-expanded={showMenu}
            >
              <MoreVertical className="size-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-base-100 rounded-2xl shadow-2xl border border-base-300 z-50 overflow-hidden animate-scale-in">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowInfo(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 text-left"
                >
                  <Info className="size-4 text-base-content/60" /> View contact info
                </button>
                <button
                  onClick={handleClearChat}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 text-left"
                >
                  <Trash2 className="size-4 text-base-content/60" /> Clear chat
                </button>
                <button
                  onClick={handleToggleBlock}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-error/10 text-error text-left"
                >
                  {isBlocked ? (
                    <>
                      <ShieldCheck className="size-4" /> Unblock {selectedUser.fullName.split(" ")[0]}
                    </>
                  ) : (
                    <>
                      <Ban className="size-4" /> Block {selectedUser.fullName.split(" ")[0]}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setSelectedUser(null)}
            className="btn btn-ghost btn-sm btn-circle hidden lg:flex hover:bg-error/10 hover:text-error"
            aria-label="Close chat"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {showInfo && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="bg-base-100 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 btn btn-ghost btn-circle btn-sm"
              onClick={() => setShowInfo(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            <div className="flex flex-col items-center gap-3 pt-2">
              {selectedUser.profilePic ? (
                <img
                  src={selectedUser.profilePic}
                  alt={selectedUser.fullName}
                  className="size-24 rounded-full object-cover ring-4 ring-primary/20"
                />
              ) : (
                <div className="size-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center font-bold text-2xl ring-4 ring-primary/20">
                  {getInitials(selectedUser.fullName)}
                </div>
              )}
              <div className="text-center">
                <h3 className="font-bold text-lg">{selectedUser.fullName}</h3>
                <p className={`text-xs ${isOnline ? "text-emerald-500" : "text-base-content/50"}`}>
                  {isOnline ? "Online" : "Offline"}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {selectedUser.about && (
                <div className="bg-base-200 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] uppercase text-base-content/40 font-semibold mb-0.5">
                    About
                  </p>
                  <p>{selectedUser.about}</p>
                </div>
              )}
              {selectedUser.phone && (
                <div className="bg-base-200 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] uppercase text-base-content/40 font-semibold mb-0.5">
                    Phone
                  </p>
                  <p>{selectedUser.phone}</p>
                </div>
              )}
              <div className="bg-base-200 rounded-xl px-4 py-2.5">
                <p className="text-[10px] uppercase text-base-content/40 font-semibold mb-0.5">
                  Member since
                </p>
                <p>{formatDate(selectedUser.createdAt)}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleClearChat}
                className="btn btn-ghost btn-sm flex-1 gap-2"
              >
                <Trash2 className="size-4" /> Clear chat
              </button>
              <button
                onClick={handleToggleBlock}
                className={`btn btn-sm flex-1 gap-2 ${isBlocked ? "btn-outline" : "btn-error btn-outline"}`}
              >
                {isBlocked ? <ShieldCheck className="size-4" /> : <Ban className="size-4" />}
                {isBlocked ? "Unblock" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
