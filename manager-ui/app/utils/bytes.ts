// Bytes as something a human reads, in the largest binary unit the number
// fills and in the language of the interface: a mailbox quota is "100 MB" in
// English and "100 Mo" in French, a disk "1.5 TB" or "1,5 To". Units and
// decimal mark come from Intl, never from a table of our own. The only byte
// formatter in the app, auto-imported everywhere.
export const KB = 1024;
// The unit every quota form works in: a field is typed in Mo and stored in
// bytes, so the conversion is one shared constant rather than one per page.
export const MB = 1024 * KB;
export const GB = 1024 * MB;
export const TB = 1024 * GB;

const SCALE = [
  ["terabyte", TB, 1],
  ["gigabyte", GB, 1],
  ["megabyte", MB, 0],
  ["kilobyte", KB, 0],
] as const;

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, unit: string, digits: number) {
  const key = `${locale}|${unit}|${digits}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: unit === "byte" ? "long" : "short",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(key, cached);
  }
  return cached;
}

// "fr_FR" cut to "fr", read from the app's own i18n where there is one: the
// request's locale on the server, the live one on the client, and reading it
// registers the dependency, so a switch of language redraws every size. Under
// vitest there is no app and English stands.
function unitLocale() {
  if (typeof tryUseNuxtApp === "function") {
    const code = tryUseNuxtApp()?.$i18n.locale.value;
    if (typeof code === "string") return code.split("_")[0] ?? "en";
  }
  return "en";
}

// A quota reaches the interface as a string (the API sends bigints as text), so
// the caller passes `Number(row.quota)`, which is NaN on a malformed value: the
// guard below prints "0 bytes" rather than "NaN GB".
export function formatBytes(bytes: number) {
  const locale = unitLocale();
  if (!Number.isFinite(bytes) || bytes <= 0) return formatter(locale, "byte", 0).format(0);
  for (const [unit, size, digits] of SCALE) {
    if (bytes >= size) return formatter(locale, unit, digits).format(bytes / size);
  }
  return formatter(locale, "byte", 0).format(bytes);
}
