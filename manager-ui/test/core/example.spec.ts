import { describe, it, expect } from "vitest";
import { ref } from "vue";
import { countryFlagEmoji, COUNTRY_CODES } from "~/utils/countries";
import { rspamdActionColor } from "~/composables/useRspamdPage";
import { useSortableColumns } from "~/composables/useSortableHeader";

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

describe("useSortableColumns", () => {
  it("toggles direction on the active column and switches column otherwise", () => {
    const sortBy = ref("time");
    const sortDir = ref<"asc" | "desc">("desc");
    const UButton = "UButton"; // a string is a valid resolveComponent result; header() wraps it in h() and we read the vnode props
    const { header } = useSortableColumns(sortBy, sortDir, UButton);

    // Active column vnode carries the direction arrow + an onClick that flips it.
    const active = header("time", "Time")().props as { icon: string; onClick: () => void };
    expect(active.icon).toBe("i-lucide-arrow-down-wide-narrow"); // desc
    active.onClick();
    expect(sortDir.value).toBe("asc");

    // A non-active column shows the neutral arrow and, on click, becomes active asc.
    const other = header("size", "Size")().props as { icon: string; onClick: () => void };
    expect(other.icon).toBe("i-lucide-arrow-up-down");
    other.onClick();
    expect(sortBy.value).toBe("size");
    expect(sortDir.value).toBe("asc");
  });
});
