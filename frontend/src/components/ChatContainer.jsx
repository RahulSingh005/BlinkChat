import React, { useEffect, useRef, useCallback, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  formatMessageTime,
  getDateSeparatorLabel,
  shouldShowDateSeparator,
  getInitials,
} from "../lib/utils";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import DateSeparator from "./DateSeparator";
import TypingIndicator from "./TypingIndicator";
import { ChevronDown, Copy, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const Message = React.memo(({ message, isSender, authUser, selectedUser }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!message.image);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!message.text) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const avatar = isSender
    ? authUser?.profilePic
    : selectedUser?.profilePic;

  return (
    <div
      className={`flex ${isSender ? "justify-end" : "justify-start"} group animate-message-in`}
      role="listitem"
    >
      <div
        className={`max-w-[88%] sm:max-w-[75%] flex gap-2.5 ${
          isSender ? "flex-row-reverse" : "flex-row"
        }`}
      >
        <div className="shrink-0 self-end mb-1">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="w-8 h-8 rounded-full ring-2 ring-base-300/50 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-[10px] font-bold ring-2 ring-base-300/50">
              {getInitials(
                isSender ? authUser?.fullName : selectedUser?.fullName
              )}
            </div>
          )}
        </div>

        <div className={`space-y-1 ${isSender ? "items-end" : "items-start"}`}>
          <div
            className={`relative group/bubble ${
              isSender ? "items-end" : "items-start"
            } flex flex-col`}
          >
            <div
              className={`px-4 py-2.5 shadow-sm ${
                isSender
                  ? "bg-gradient-to-br from-primary to-primary/90 text-primary-content rounded-2xl rounded-br-md"
                  : "bg-base-200/90 text-base-content rounded-2xl rounded-bl-md border border-base-300/50"
              }`}
            >
              {message.image && (
                <div className="relative mb-2 overflow-hidden rounded-xl -mx-1">
                  {imageLoading && (
                    <div className="absolute inset-0 bg-base-300/50 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  )}
                  {!imageError ? (
                    <img
                      src={message.image}
                      alt="Attachment"
                      className="max-w-[240px] sm:max-w-[300px] rounded-lg"
                      onError={() => {
                        setImageError(true);
                        setImageLoading(false);
                      }}
                      onLoad={() => setImageLoading(false)}
                      loading="lazy"
                    />
                  ) : (
                    <div className="p-3 bg-error/10 text-error text-xs rounded-lg">
                      Failed to load image
                    </div>
                  )}
                </div>
              )}

              {message.text && (
                <div className="chat-bubble-text break-words whitespace-pre-wrap text-sm leading-relaxed">
                  {message.text}
                </div>
              )}
            </div>

            {message.text && (
              <button
                onClick={handleCopy}
                className={`absolute top-1 ${
                  isSender ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"
                } opacity-0 group-hover/bubble:opacity-100 transition-opacity btn btn-ghost btn-xs btn-circle`}
                aria-label="Copy message"
              >
                {copied ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            )}
          </div>

          <time
            className="text-[10px] text-base-content/40 px-1"
            dateTime={message.createdAt}
          >
            {formatMessageTime(message.createdAt)}
          </time>
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
    typingUsers,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "nearest" });
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - (scrollTop + clientHeight) < 80);
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
    getMessages(selectedUser._id);
  }, [selectedUser?._id, getMessages]);

  const handleSend = () => {
    setTimeout(() => scrollToBottom(), 100);
  };

  const isTyping = typingUsers[selectedUser?._id];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-base-100 to-base-200/30 relative">
      <ChatHeader />

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-4 lg:px-5 space-y-1 scrollbar-thin relative"
        role="list"
        aria-label="Messages"
      >
        {isMessagesLoading ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="text-3xl">👋</span>
            </div>
            <div>
              <p className="font-semibold">Say hello to {selectedUser?.fullName}!</p>
              <p className="text-sm text-base-content/50 mt-1">
                Send a message to start the conversation
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <React.Fragment key={message._id || message.createdAt}>
              {shouldShowDateSeparator(message, messages[index - 1]) && (
                <DateSeparator
                  label={getDateSeparatorLabel(message.createdAt)}
                />
              )}
              <Message
                message={message}
                isSender={message.senderId === authUser?._id}
                authUser={authUser}
                selectedUser={selectedUser}
              />
            </React.Fragment>
          ))
        )}

        {isTyping && (
          <TypingIndicator name={selectedUser?.fullName?.split(" ")[0]} />
        )}

        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {!autoScroll && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-24 right-5 btn btn-circle btn-primary btn-sm shadow-xl z-20 animate-bounce-subtle"
          aria-label="Scroll to latest message"
        >
          <ChevronDown className="size-4" />
        </button>
      )}

      <MessageInput onSend={handleSend} />
    </div>
  );
};

export default ChatContainer;
