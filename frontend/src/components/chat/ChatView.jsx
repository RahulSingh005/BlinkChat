import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatSearch from "./ChatSearch";
import Composer from "./Composer";
import InfoPanel from "./InfoPanel";
import MessageList from "./MessageList";
import ScheduledBar from "./ScheduledBar";
import { MessagesSkeleton } from "../ui/Skeletons";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { useChatStore } from "../../store/useChatStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUIStore } from "../../store/useUIStore";

/** One open conversation: header, messages, composer and side panels. */
export default function ChatView({ conversationId }) {
  const conv = useChatStore((s) => s.conversations[conversationId]);
  const wallpaper = useSettingsStore((s) => s.wallpaper);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const infoOpen = useUIStore((s) => s.infoOpen);
  const desktop = useIsDesktop();
  const composerRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const onDragEnter = useCallback((e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }, []);
  const onDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) composerRef.current?.addFiles(files);
  }, []);

  if (!conv) {
    return (
      <div className="flex min-w-0 flex-1 flex-col bg-base-100">
        <div className="h-16 border-b border-base-300/70" />
        <div className={`wallpaper-${wallpaper} flex flex-1`}>
          <MessagesSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col bg-base-100"
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.dataTransfer?.types?.includes("Files") && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ChatHeader conv={conv} />
      <ScheduledBar conv={conv} />
      <MessageList conv={conv} wallpaper={wallpaper} />
      <Composer ref={composerRef} conv={conv} />

      {searchOpen && <ChatSearch conv={conv} />}

      {infoOpen && !desktop && (
        <div className="absolute inset-0 z-30 flex justify-end">
          <button type="button" className="anim-fade absolute inset-0 bg-black/30" aria-label="Close details" onClick={() => useUIStore.getState().close("infoOpen")} />
          <div className="anim-drawer relative flex h-full w-full max-w-[400px] border-l border-base-300/70 bg-base-100 shadow-float">
            <InfoPanel conversationId={conv._id} />
          </div>
        </div>
      )}

      {dragging && (
        <div className="anim-fade pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary/50 bg-base-100/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="size-8" />
            <span className="font-semibold">Drop files to send</span>
          </div>
        </div>
      )}
    </div>
  );
}
