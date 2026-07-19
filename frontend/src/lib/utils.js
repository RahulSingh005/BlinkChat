export function formatDate(isoDate) {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRelativeTime(date) {
  const now = new Date();
  const msgDate = new Date(date);
  const diffMs = now - msgDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return msgDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getDateSeparatorLabel(date) {
  const msgDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(msgDate, today)) return "Today";
  if (isSameDay(msgDate, yesterday)) return "Yesterday";

  return msgDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: msgDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export function shouldShowDateSeparator(currentMsg, prevMsg) {
  if (!prevMsg) return true;
  const curr = new Date(currentMsg.createdAt);
  const prev = new Date(prevMsg.createdAt);
  return (
    curr.getFullYear() !== prev.getFullYear() ||
    curr.getMonth() !== prev.getMonth() ||
    curr.getDate() !== prev.getDate()
  );
}

export function getInitials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAvatarUrl(user, fallbackIndex = 1) {
  if (user?.profilePic) return user.profilePic;
  const seed = user?._id || user?.fullName || fallbackIndex;
  const hash = [...String(seed)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `https://i.pravatar.cc/150?img=${(hash % 70) + 1}`;
}

export function getMessagePreview(message) {
  if (!message) return "Start a conversation";
  if (message.image && !message.text) return "📷 Photo";
  if (message.image && message.text) return `📷 ${message.text}`;
  return message.text || "Start a conversation";
}
