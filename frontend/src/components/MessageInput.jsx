import { useRef, useState, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const { sendMessage } = useChatStore();

  const handleImageChange = (file) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
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
      await sendMessage({
        text: text.trim(),
        image: imagePreview,
      });
      setText("");
      removeImage();
    } catch (error) {
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

  return (
    <div className="p-4 w-full border-t border-base-300 bg-base-100">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative group">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-base-300 shadow-sm"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 size-6 rounded-full bg-error text-error-content
                       flex items-center justify-center shadow hover:bg-error-focus transition-colors"
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
        className={`relative flex items-center gap-2 ${isDragging ? "ring-2 ring-primary" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <textarea
              rows="1"
              className="textarea textarea-bordered w-full pr-12 resize-none"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Message input"
            />
            
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                type="button"
                className={`btn btn-ghost btn-sm btn-square
                  ${imagePreview ? "text-primary" : "text-base-content"} 
                  hover:bg-base-300`}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image"
              >
                <Image size={20} />
              </button>
            </div>
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
          className={`btn btn-circle btn-sm sm:btn-md btn-primary
            ${!text && !imagePreview ? "btn-disabled" : ""}
            ${isSending ? "pointer-events-none" : ""}`}
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>

      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center text-primary rounded-lg">
          Drop image to upload
        </div>
      )}
    </div>
  );
};

export default MessageInput;
