import React, { useEffect, useRef, useCallback, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { Loader2 } from "lucide-react";

const Message = React.memo(({ message, isSender, authUser, selectedUser }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!message.image);

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  return (
    <div
      className={`flex ${isSender ? "justify-end" : "justify-start"} group mb-4`}
      role="listitem"
    >
      <div className={`max-w-[85%] flex gap-2 ${isSender ? "flex-row-reverse" : "flex-row"}`}>
        <div className="shrink-0">
          <img
            src={
              isSender
                ? authUser?.profilePic || "/avatar.png"
                : selectedUser?.profilePic || "/avatar.png"
            }
            alt="Profile"
            className="w-10 h-10 rounded-full border-2 border-base-200 object-cover"
            aria-hidden="true"
          />
        </div>
        <div className={`space-y-1 ${isSender ? "items-end" : "items-start"}`}>
          <div className="flex items-center gap-2 text-sm text-base-content/60">
            <span>{isSender ? "You" : selectedUser?.fullName || "User"}</span>
            <time className="" dateTime={message.createdAt}>
              {formatMessageTime(message.createdAt)}
            </time>
          </div>

          <div
            className={`p-3 rounded-2xl ${
              isSender
                ? "bg-primary text-primary-content rounded-br-none"
                : "bg-base-200 rounded-bl-none"
            }`}
          >
            {message.image && (
              <div className="relative mb-2 overflow-hidden rounded-lg">
                {imageLoading && (
                  <div className="absolute inset-0 bg-base-300/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
                {!imageError ? (
                  <img
                    src={message.image}
                    alt="Attachment"
                    className="max-w-[240px] sm:max-w-[320px]"
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                    loading="lazy"
                  />
                ) : (
                  <div className="p-4 bg-error/10 text-error text-sm rounded-lg">
                    Failed to load image
                  </div>
                )}
              </div>
            )}

            {message.text && (
              <div className="break-words whitespace-pre-wrap">{message.text}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({
      behavior,
      block: "nearest",
    });
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - (scrollTop + clientHeight) < 50);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom(messages.length > 10 ? "auto" : "smooth");
    }
  }, [messages, autoScroll, scrollToBottom]);

  useEffect(() => {
    if (!selectedUser?._id) return;

    let isMounted = true;
    const initChat = async () => {
      await getMessages(selectedUser._id);
      if (isMounted) subscribeToMessages();
    };

    initChat();
    return () => {
      isMounted = false;
      unsubscribeFromMessages();
    };
  }, [selectedUser?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  const handleSend = () => {
    setTimeout(() => scrollToBottom(), 100);
  };

  return (
    <div className="flex-1 flex flex-col">
      <ChatHeader />

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-100"
      >
        {isMessagesLoading ? (
          <MessageSkeleton />
        ) : (
          messages.map((message) => (
            <Message
              key={message._id || message.createdAt}
              message={message}
              isSender={message.senderId === authUser?._id}
              authUser={authUser}
              selectedUser={selectedUser}
            />
          ))
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {!autoScroll && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="fixed bottom-24 right-8 btn btn-circle btn-primary btn-sm shadow-lg"
          aria-label="Scroll to latest message"
        >
          ↓
        </button>
      )}

      <MessageInput onSend={handleSend} />
    </div>
  );
};

export default ChatContainer;
