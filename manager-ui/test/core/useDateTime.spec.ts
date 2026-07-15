import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { useDateTime } from "~/composables/useDateTime";

function stubLocale(locale: string) {
  vi.stubGlobal("useI18n", () => ({
    t: (k: string) => k,
    te: () => true,
    locale: ref(locale),
    locales: ref([]),
  }));
}

describe("useDateTime.formatDateTime", () => {
  it("renders a dash for missing or unparseable values", () => {
    stubLocale("en_EN");
    const { formatDateTime } = useDateTime();
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
    expect(formatDateTime("")).toBe("-");
    expect(formatDateTime("not-a-date")).toBe("-");
  });

  it("renders a valid ISO timestamp with the app's language subtag only", () => {
    stubLocale("en_EN");
    const { formatDateTime } = useDateTime();
    const iso = "2026-07-08T18:22:01.000Z";
    // Delegates to Intl with only the language subtag ("en", never "EN") and the
    // medium/short styles; mirror that expectation so the assertion is
    // timezone-independent.
    const expected = new Date(iso).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
    expect(formatDateTime(iso)).toBe(expected);
    expect(formatDateTime(iso)).not.toBe("-");
  });

  it("splits fr_FR down to fr for Intl", () => {
    stubLocale("fr_FR");
    const { formatDateTime } = useDateTime();
    const iso = "2026-07-08T18:22:01.000Z";
    const expected = new Date(iso).toLocaleString("fr", { dateStyle: "medium", timeStyle: "short" });
    expect(formatDateTime(iso)).toBe(expected);
  });

  it("handles a locale id that has no region suffix", () => {
    stubLocale("de");
    const { formatDateTime } = useDateTime();
    const iso = "2026-07-08T18:22:01.000Z";
    const expected = new Date(iso).toLocaleString("de", { dateStyle: "medium", timeStyle: "short" });
    expect(formatDateTime(iso)).toBe(expected);
  });
});
