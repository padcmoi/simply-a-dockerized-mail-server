// Share of a mailbox's reservation that dovecot has actually written to disk.
//
// Capped at 100: a mailbox can legitimately sit above its quota, either because
// dovecot delivered a message that crossed the line or because the quota was
// lowered under existing mail. A bar past its own track reads as a bug.
//
// A quota of 0 (postmaster@, or a row whose virtual_users entry is gone) has no
// meaningful ratio, so it reads as empty rather than dividing by zero.
export function occupancyPercent(quota: number, usedBytes: number) {
  if (!Number.isFinite(quota) || quota <= 0) return 0;
  return Math.min(100, (usedBytes / quota) * 100);
}

export function occupancyColor(percent: number) {
  if (percent > 90) return "error";
  if (percent > 70) return "warning";
  return "success";
}
