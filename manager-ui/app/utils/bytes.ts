// Bytes as something a human reads, in the largest unit the number fills: a
// mailbox quota is "100 MB", a disk "1.5 TB". Nothing in the interface ever
// prints a raw byte count, which is a run of digits nobody can size at a
// glance. The only byte formatter in the app, auto-imported everywhere.
export const KB = 1024;
// The unit every quota form works in: a field is typed in Mo and stored in
// bytes, so the conversion is one shared constant rather than one per page.
export const MB = 1024 * KB;
export const GB = 1024 * MB;
export const TB = 1024 * GB;

// A quota reaches the interface as a string (the API sends bigints as text), so
// the caller passes `Number(row.quota)`, which is NaN on a malformed value: the
// guard below prints "0 B" rather than "NaN GB".
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= TB) return `${(bytes / TB).toFixed(1)} TB`;
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${bytes.toFixed(0)} B`;
}
