const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const weekdayShortFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fullDayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const fullDayYearFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat(undefined, { year: "2-digit", month: "numeric", day: "numeric" });
const longDateFmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const toDate = (d) => (d instanceof Date ? d : new Date(d));

export const isSameDay = (a, b) => {
  const x = toDate(a);
  const y = toDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

const daysAgo = (d) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = toDate(d);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  return Math.round((start - dayStart) / 86400000);
};

export const formatTime = (d) => (d ? timeFmt.format(toDate(d)) : "");

export const formatDateTime = (d) => (d ? dateTimeFmt.format(toDate(d)) : "");

export const formatLongDate = (d) => (d ? longDateFmt.format(toDate(d)) : "");

/** Conversation list: 9:41 AM · Yesterday · Mon · Mar 4 · 3/4/25 */
export function formatListTime(d) {
  if (!d) return "";
  const date = toDate(d);
  const ago = daysAgo(date);
  if (ago <= 0) return timeFmt.format(date);
  if (ago === 1) return "Yesterday";
  if (ago < 7) return weekdayShortFmt.format(date);
  if (date.getFullYear() === new Date().getFullYear()) return monthDayFmt.format(date);
  return shortDateFmt.format(date);
}

/** Date separators: Today · Yesterday · Monday · Monday, March 4 */
export function formatDayLabel(d) {
  const date = toDate(d);
  const ago = daysAgo(date);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  if (ago < 7) return weekdayFmt.format(date);
  if (date.getFullYear() === new Date().getFullYear()) return fullDayFmt.format(date);
  return fullDayYearFmt.format(date);
}

export function formatLastSeen(d) {
  if (!d) return "last seen recently";
  const date = toDate(d);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins} min ago`;
  const ago = daysAgo(date);
  if (ago <= 0) return `last seen today at ${timeFmt.format(date)}`;
  if (ago === 1) return `last seen yesterday at ${timeFmt.format(date)}`;
  if (ago < 7) return `last seen ${weekdayFmt.format(date)} at ${timeFmt.format(date)}`;
  return `last seen ${monthDayFmt.format(date)}`;
}

/** "2m", "3h", "4d", "2w" */
export function formatAgoShort(d) {
  const mins = Math.max(0, Math.floor((Date.now() - toDate(d).getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/** "until 3:00 PM", "until tomorrow 9:00 AM", "until Mon 9:00 AM" */
export function formatUntil(d) {
  const date = toDate(d);
  const ago = daysAgo(date);
  if (ago === 0) return `until ${timeFmt.format(date)}`;
  if (ago === -1) return `until tomorrow ${timeFmt.format(date)}`;
  if (ago > -7) return `until ${weekdayShortFmt.format(date)} ${timeFmt.format(date)}`;
  return `until ${monthDayFmt.format(date)}`;
}

/** Scheduling labels: "Today 6:00 PM", "Tomorrow 9:00 AM", "Fri 9:00 AM" */
export function formatWhen(d) {
  const date = toDate(d);
  const ago = daysAgo(date);
  const t = timeFmt.format(date);
  if (ago === 0) return `Today ${t}`;
  if (ago === -1) return `Tomorrow ${t}`;
  if (ago > -7 && ago < 0) return `${weekdayShortFmt.format(date)} ${t}`;
  return `${monthDayFmt.format(date)}, ${t}`;
}

export function formatDuration(totalSeconds = 0) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function formatBytes(bytes = 0) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export const firstName = (name = "") => String(name).trim().split(/\s+/)[0] || "";

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
