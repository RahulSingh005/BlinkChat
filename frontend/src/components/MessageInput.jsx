import { useRef, useState, useCallback, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, Smile, X, Loader2, ShieldOff } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPicker from "./EmojiPicker";

const MessageInput = ({ onSend }) => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { sendMessage, selectedUser, emitTyping, toggleBlockUser } = useChatStore();
  const { authUser } = useAuthStore();

  const isBlocked = authUser?.blockedUsers?.some(
    (id) => String(id) === String(selectedUser?._id)
  );

  const handleTyping = useCallback(
    (value) => {
      if (!selectedUser) return;
      emitTyping(selectedUser._id, value.length > 0);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(selectedUser._id, false);
      }, 2000);
    },
    [selectedUser, emitTyping]
  );

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      if (selectedUser) emitTyping(selectedUser._id, false);
    };
  }, [selectedUser, emitTyping]);

  const MAX_IMAGE_MB = 8;

  const handleImageChange = (file) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    // Full-resolution phone camera photos can be 10-15MB+. Reading one of
    // those into a base64 string in-memory can freeze or crash the tab on
    // mid/low-end mobile devices, so we cap it here instead of letting the
    // browser choke on it silently.
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Image is too large. Please choose one under ${MAX_IMAGE_MB}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.onerror = () => toast.error("Couldn't read that image, please try another one");
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageChange(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageChange(file);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !imagePreview) || isSending) return;

    try {
      setIsSending(true);
      emitTyping(selectedUser._id, false);
      await sendMessage({
        text: text.trim(),
        image: imagePreview,
      });
      setText("");
      removeImage();
      setShowEmojiPicker(false);
      onSend?.();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    handleTyping(e.target.value);
  };

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="p-3 lg:p-4 border-t border-base-300/80 bg-base-100/95 backdrop-blur-md relative">
      {isBlocked ? (
        <div className="flex items-center justify-between gap-3 bg-base-200 rounded-2xl px-4 py-3">
          <span className="text-sm text-base-content/60 flex items-center gap-2">
            <ShieldOff className="size-4" /> You've blocked {selectedUser.fullName}.
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline rounded-xl"
            onClick={() => toggleBlockUser(selectedUser._id)}
          >
            Unblock
          </button>
        </div>
      ) : (
        <>
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2 animate-fade-in">
          <div className="relative group">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-xl border border-base-300 shadow-md"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 size-6 rounded-full bg-error text-error-content flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              type="button"
              aria-label="Remove image"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className={`relative flex items-end gap-2 ${isDragging ? "ring-2 ring-primary rounded-xl" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="relative flex-1">
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={insertEmoji}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}

          <div className="flex items-end gap-1 bg-base-200/60 rounded-2xl border border-base-300/60 px-2 py-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="btn btn-ghost btn-sm btn-circle shrink-0 text-base-content/60 hover:text-primary"
              aria-label="Open emoji picker"
            >
              <Smile size={20} />
            </button>

            <textarea
              rows="1"
              className="flex-1 bg-transparent border-none outline-none resize-none py-2 px-1 max-h-32 text-sm placeholder:text-base-content/40"
              placeholder="Type a message..."
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              aria-label="Message input"
            />

            <button
              type="button"
              className={`btn btn-ghost btn-sm btn-circle shrink-0 ${
                imagePreview ? "text-primary" : "text-base-content/60"
              }`}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
            >
              <Image size={20} />
            </button>
          </div>
        </div>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileInput}
        />

        <button
          type="submit"
          disabled={(!text.trim() && !imagePreview) || isSending}
          className="btn btn-circle btn-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all shrink-0"
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>

      {isDragging && (
        <div className="absolute inset-2 bg-primary/10 backdrop-blur-sm flex items-center justify-center text-primary font-medium rounded-xl border-2 border-dashed border-primary/40 z-10">
          Drop image to attach
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default MessageInput;
