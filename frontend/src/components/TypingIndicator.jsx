const TypingIndicator = ({ name }) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-base-content/60 animate-fade-in">
      <div className="flex items-center gap-1 bg-base-200 rounded-2xl px-4 py-2">
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
        <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
      </div>
      <span className="text-xs">{name} is typing...</span>
    </div>
  );
};

export default TypingIndicator;
