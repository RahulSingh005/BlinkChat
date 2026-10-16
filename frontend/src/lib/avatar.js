// Deterministic, tasteful initials avatars (the old app showed random
// strangers' photos from pravatar.cc for anyone without a picture).
const HUES = [265, 230, 200, 170, 145, 95, 55, 25, 350, 320, 290];

export function hueFor(seed = "") {
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[hash % HUES.length];
}

export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = [...parts[0]][0] || "";
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] || "" : "";
  return (first + last).toUpperCase();
}

/** Stable color for a person's name in group chats. */
export const nameColor = (seed) => `oklch(0.58 0.15 ${hueFor(seed)})`;
