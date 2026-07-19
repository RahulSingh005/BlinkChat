const EMOJI_CATEGORIES = [
  {
    label: "Smileys",
    emojis: ["😀", "😂", "🥹", "😍", "🤩", "😎", "🤔", "😅", "🙌", "👍", "👋", "🎉", "❤️", "🔥", "✨", "💯"],
  },
  {
    label: "Gestures",
    emojis: ["👏", "🙏", "💪", "🤝", "✌️", "🤞", "👀", "💀", "😭", "🥳", "😤", "🫡", "🤗", "😴", "🤯", "😱"],
  },
  {
    label: "Objects",
    emojis: ["📷", "🎵", "☕", "🍕", "🚀", "💡", "📌", "✅", "❌", "⭐", "🌙", "☀️", "🌈", "💬", "📎", "🎁"],
  },
];

const EmojiPicker = ({ onSelect, onClose }) => {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-base-100 border border-base-300 rounded-2xl shadow-2xl z-50 animate-scale-in overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-200/50">
        <span className="text-sm font-semibold">Emoji</span>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-xs btn-circle"
          aria-label="Close emoji picker"
        >
          ✕
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-2">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <p className="text-xs text-base-content/50 px-1 mb-1">{cat.label}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="text-xl p-1.5 rounded-lg hover:bg-base-200 transition-colors"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
