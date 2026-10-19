import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatSearch from "./ChatSearch";
import Composer from "./Composer";
import InfoPanel from "./InfoPanel";
import MessageList from "./MessageList";
import PinnedBar from "./PinnedBar";
import ScheduledBar from "./ScheduledBar";
import { MessagesSkeleton } from "../ui/Skeletons";
import { useIsDesktop, useIsWide } from "../../hooks/useMediaQuery";
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
  const wide = useIsWide();
  const navigate = useNavigate();
  const composerRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  // Desktop: Esc closes the chat (dialogs and menus handle Esc first).
  useEffect(() => {
    if (!wide) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target.closest?.("input, textarea, [contenteditable=true], [role=dialog], [role=menu]")) return;
      const ui = useUIStore.getState();
      if (ui.lightbox || ui.searchOpen) return;
      if (ui.infoOpen) return ui.close("infoOpen");
      navigate("/chat", { viewTransition: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide, navigate]);

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
        <div className="safe-top border-b border-base-300/70">
          <div className="flex h-header items-center gap-3 px-4">
            <div className="skeleton-line size-10 rounded-full" />
            <div className="space-y-1.5">
              <div className="skeleton-line h-3 w-32" />
              <div className="skeleton-line h-2.5 w-20" />
            </div>
          </div>
        </div>
        <div className={`wallpaper-${wallpaper} flex flex-1`}>
          <MessagesSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col bg-base-100 [container-type:inline-size]"
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.dataTransfer?.types?.includes("Files") && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ChatHeader conv={conv} />
      <PinnedBar conv={conv} />
      <ScheduledBar conv={conv} />
      <MessageList conv={conv} wallpaper={wallpaper} />
      <Composer ref={composerRef} conv={conv} />

      {searchOpen && <ChatSearch conv={conv} />}

      {infoOpen && !desktop && (
        <div className="absolute inset-0 z-30 flex justify-end">
          <button type="button" className="anim-fade absolute inset-0 bg-black/30" aria-label="Close details" onClick={() => useUIStore.getState().close("infoOpen")} />
          <div className="anim-drawer relative flex h-full w-full max-w-[420px] border-l border-base-300/70 bg-base-100 shadow-float">
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
