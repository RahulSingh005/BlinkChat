import EmojiPicker, { EmojiStyle, SuggestionMode, Theme } from "emoji-picker-react";
import { useIsWide } from "../../hooks/useMediaQuery";
import { useSettingsStore } from "../../store/useSettingsStore";
import Popover from "./Popover";
import Sheet from "./Sheet";

/**
 * Full emoji picker (loaded lazily — it's the heaviest dependency).
 * Native emoji only: no images fetched from a CDN.
 */
export default function EmojiPopover({ anchor, onClose, onPick, keepOpen = false }) {
  const wide = useIsWide();
  const dark = useSettingsStore((s) => s.resolvedTheme === "blinkdark");

  const picker = (
    <EmojiPicker
      onEmojiClick={(data) => {
        onPick(data.emoji);
        if (!keepOpen) onClose();
      }}
      emojiStyle={EmojiStyle.NATIVE}
      theme={dark ? Theme.DARK : Theme.LIGHT}
      lazyLoadEmojis
      autoFocusSearch={wide}
      suggestedEmojisMode={SuggestionMode.RECENT}
      previewConfig={{ showPreview: false }}
      skinTonesDisabled={!wide}
      searchPlaceholder="Search emoji"
      width={wide ? 340 : "100%"}
      height={wide ? 400 : 360}
    />
  );

  if (!wide) {
    return (
      <Sheet open onClose={onClose} size="sm" showClose={false} bare>
        <div className="px-2 pb-2">{picker}</div>
      </Sheet>
    );
  }
  return (
    <Popover anchor={anchor} onClose={onClose} width={340} autoFocus={false} className="overflow-hidden">
      {picker}
    </Popover>
  );
}
