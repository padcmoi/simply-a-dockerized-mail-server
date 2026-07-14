// The API answers UTC ISO-8601 ("2026-07-08T18:22:01.000Z"). Printed as-is
// that is a Zulu timestamp no one reads, and it is an hour or two off for
// anyone in Europe. `Date` parses the offset and the browser renders it in the
// viewer's own timezone and locale.
export function useDateTime() {
  const { locale } = useI18n();

  // `fr_FR` / `en_EN` are this app's own locale ids, not BCP-47 tags, and
  // there is no such region as "EN". Only the language subtag is kept; Intl
  // resolves the rest on its own.
  const intlLocale = computed(() => locale.value.split("_")[0]);

  // A recipient dovecot has never delivered to carries no activity date, and
  // an unparseable value must not render "Invalid Date" in a table cell.
  function formatDateTime(iso: string | null | undefined) {
    if (!iso) return "-";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString(intlLocale.value, { dateStyle: "medium", timeStyle: "short" });
  }

  // Relative "time ago" for a past timestamp ("3 minutes ago" / "il y a 3
  // minutes"), localized. Returns null for a missing/unparseable value so the
  // caller can render nothing. Computed at call time, so it refreshes whenever
  // its data reloads (the sessions list re-fetches on the shared refresh tick).
  function timeAgo(iso: string | null | undefined) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(intlLocale.value, { numeric: "auto" });
    const abs = Math.abs(diffSec);
    if (abs < 60) return rtf.format(diffSec, "second");
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
    return rtf.format(Math.round(diffSec / 86400), "day");
  }

  return { formatDateTime, timeAgo };
}
