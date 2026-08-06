import { describe, it, expect } from "vitest";
import { countryFlagEmoji, COUNTRY_CODES } from "~/utils/countries";
import { rspamdActionColor } from "~/composables/useRspamdPage";

describe("countries util", () => {
  it("maps a code to its regional-indicator flag", () => {
    // FR -> two regional indicator symbols (U+1F1EB U+1F1F7)
    expect(countryFlagEmoji("FR")).toBe("\u{1F1EB}\u{1F1F7}");
    expect(countryFlagEmoji("fr")).toBe(countryFlagEmoji("FR"));
  });
  it("has a non-empty unique code list", () => {
    expect(COUNTRY_CODES.length).toBeGreaterThan(200);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });
});

describe("rspamdActionColor", () => {
  it("maps actions to semantic colors", () => {
    expect(rspamdActionColor("no action")).toBe("success");
    expect(rspamdActionColor("reject")).toBe("error");
    expect(rspamdActionColor("greylist")).toBe("info");
    expect(rspamdActionColor("add header")).toBe("warning");
  });
});
