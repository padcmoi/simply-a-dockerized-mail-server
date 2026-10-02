const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UTC_STAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) /;
const DAY_MINUTES = 1440;

function offsetMinutes(zone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return Math.round((wall - at.getTime()) / 60_000);
}

export function viewerZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function convertZoneTime(time: string, from: string, to: string, at = new Date()) {
  const match = CLOCK.exec(time);
  if (!match || from === to) return time;
  try {
    const shift = offsetMinutes(to, at) - offsetMinutes(from, at);
    const minutes = (((Number(match[1]) * 60 + Number(match[2]) + shift) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  } catch {
    return time;
  }
}

export function logLineInZone(line: string, zone = viewerZone()) {
  const match = UTC_STAMP.exec(line);
  if (!match) return line;
  const stamp = new Date(match[1] ?? "").toLocaleString("sv-SE", { timeZone: zone, hourCycle: "h23" });
  return `${stamp} ${line.slice(match[0].length)}`;
}
