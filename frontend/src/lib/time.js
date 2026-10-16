// Timezone helpers powering "their local time", the night-time nudge and
// "send at their morning". Pure Intl, DST-safe, no libraries.

export const myTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const partsCache = new Map();
const formatterFor = (tz) => {
  if (!partsCache.has(tz)) {
    partsCache.set(
      tz,
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }
  return partsCache.get(tz);
};

/** Wall-clock parts of `date` in `tz`. */
export function zonedParts(date, tz) {
  const out = {};
  for (const p of formatterFor(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out; // { year, month, day, hour, minute, second }
}

/** Minutes `tz` is ahead of UTC at `date`. */
export function offsetMinutes(tz, date = new Date()) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

export const isValidTz = (tz) => {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** "9:41 PM" in `tz`. */
export function timeIn(tz, date = new Date()) {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date);
}

export const hourIn = (tz, date = new Date()) => zonedParts(date, tz).hour;

export const isNightIn = (tz, date = new Date()) => {
  const h = hourIn(tz, date);
  return h >= 22 || h < 7;
};

/** True when two zones currently differ by at least an hour. */
export function differentZone(a, b, date = new Date()) {
  if (!isValidTz(a) || !isValidTz(b)) return false;
  return Math.abs(offsetMinutes(a, date) - offsetMinutes(b, date)) >= 60;
}

/** "5h 30m ahead" / "3h behind" relative to the viewer. */
export function zoneDiffLabel(theirTz, myTz = myTimezone()) {
  const diff = offsetMinutes(theirTz) - offsetMinutes(myTz);
  if (Math.abs(diff) < 1) return "same time as you";
  const h = Math.floor(Math.abs(diff) / 60);
  const m = Math.abs(diff) % 60;
  return `${h ? `${h}h` : ""}${m ? `${h ? " " : ""}${m}m` : ""} ${diff > 0 ? "ahead" : "behind"}`;
}

export const zoneCity = (tz = "") => tz.split("/").pop()?.replace(/_/g, " ") || tz;

/** The next instant when it's `hour:minute` on the wall clock in `tz`. */
export function nextWallTime(tz, hour, minute = 0, from = new Date()) {
  const p = zonedParts(from, tz);
  for (let addDays = 0; addDays < 3; addDays += 1) {
    const guessUtc = Date.UTC(p.year, p.month - 1, p.day + addDays, hour, minute);
    // Correct for the zone offset (twice, to settle across DST changes).
    let instant = guessUtc - offsetMinutes(tz, new Date(guessUtc)) * 60000;
    instant = guessUtc - offsetMinutes(tz, new Date(instant)) * 60000;
    if (instant > from.getTime() + 60 * 1000) return new Date(instant);
  }
  return new Date(from.getTime() + 24 * 3600 * 1000);
}

/** Shortcut presets for scheduling and reminders, in the viewer's zone. */
export function quickTimes(now = new Date()) {
  const tz = myTimezone();
  return {
    inMinutes: (m) => new Date(now.getTime() + m * 60000),
    evening: nextWallTime(tz, 19, 0, now),
    morning: nextWallTime(tz, 9, 0, now),
  };
}
