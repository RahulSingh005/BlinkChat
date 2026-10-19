import { firstName, formatDuration } from "./format";
import { stripFormatting } from "./text";

const DISAPPEARING_LABELS = { 86400: "24 hours", 604800: "7 days", 7776000: "90 days" };
export const disappearingLabel = (s) => DISAPPEARING_LABELS[s] || "off";

const nameOf = (id, message, conv, meId) => {
  if (id === meId) return "You";
  const stored = message.system?.data?.names?.[id];
  const member = conv?.members?.find((m) => m.user._id === id)?.user?.fullName;
  return firstName(member || stored || "Someone");
};

const list = (names) =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** Human sentence for group/system events. */
export function systemText(message, conv, meId) {
  const sys = message.system || {};
  const actor = nameOf(message.sender, message, conv, meId);
  const targets = (sys.targets || []).map((id) => nameOf(id, message, conv, meId));
  const t = list(targets);
  switch (sys.event) {
    case "group_created":
      return `${actor} created the group “${sys.data?.name || conv?.name || ""}”`;
    case "members_added":
      return `${actor} added ${t}`;
    case "member_removed":
      return `${actor} removed ${t}`;
    case "member_left":
      return `${t || actor} left`;
    case "admin_granted":
      return `${actor} made ${t} an admin`;
    case "admin_revoked":
      return `${actor} removed ${t} as admin`;
    case "admin_auto":
      return `${t} ${targets[0] === "You" ? "are" : "is"} now an admin`;
    case "renamed":
      return `${actor} renamed the group to “${sys.data?.name || ""}”`;
    case "description_changed":
      return `${actor} changed the group description`;
    case "avatar_changed":
      return `${actor} changed the group photo`;
    case "avatar_removed":
      return `${actor} removed the group photo`;
    case "message_pinned":
      return `${actor} pinned a message${sys.data?.preview ? `: “${sys.data.preview.slice(0, 60)}”` : ""}`;
    case "member_joined_link":
      return `${t || actor} joined using an invite link`;
    case "disappearing":
      return sys.data?.seconds
        ? `${actor} turned on disappearing messages · ${disappearingLabel(sys.data.seconds)}`
        : `${actor} turned off disappearing messages`;
    default:
      return "Chat updated";
  }
}

export function callText(message, meId) {
  const outgoing = message.sender === meId;
  const kind = message.call?.kind === "video" ? "video" : "voice";
  const status = message.call?.status;
  if (status === "completed") return `${kind === "video" ? "Video" : "Voice"} call · ${formatDuration(message.call.duration)}`;
  if (status === "declined") return outgoing ? `Declined ${kind} call` : `You declined a ${kind} call`;
  if (outgoing) return status === "unavailable" ? `${kind === "video" ? "Video" : "Voice"} call · Unavailable` : `${kind === "video" ? "Video" : "Voice"} call · No answer`;
  return `Missed ${kind} call`;
}

/** One-line preview for lists and notifications. */
export function previewText(message, { conv, meId } = {}) {
  if (!message) return "";
  if (message.deletedAt) return "Message deleted";
  if (message.type === "system") return systemText(message, conv, meId);
  if (message.type === "call") return callText(message, meId);
  const att = message.attachments?.[0];
  const text = stripFormatting(message.text || "").replace(/\s+/g, " ").trim();
  if (message.poll) return `📊 ${message.poll.question}`;
  if (message.location) return `📍 ${message.location.label || "Location"}`;
  if (message.contactCard) return `👤 ${message.contactCard.name || "Contact"}`;
  if (message.viewOnce && att) return att.kind === "video" ? "View once video" : "View once photo";
  if (att) {
    const count = message.attachments.length;
    let label;
    if (att.kind === "image") label = count > 1 ? `${count} photos` : "Photo";
    else if (att.kind === "video") label = "Video";
    else if (att.kind === "audio") label = att.voice ? `Voice message${att.duration ? ` (${formatDuration(att.duration)})` : ""}` : "Audio";
    else if (att.kind === "gif") label = "GIF";
    else if (att.kind === "sticker") label = "Sticker";
    else label = att.name || "File";
    return text ? `${label} · ${text}` : label;
  }
  return text;
}

export const attachmentKindOf = (message) => message?.attachments?.[0]?.kind || null;
