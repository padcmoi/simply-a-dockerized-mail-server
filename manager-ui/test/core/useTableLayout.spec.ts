import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowRef } from "vue";
import { useTableLayout } from "~/composables/useTableLayout";

// The measurement itself belongs to VueUse and to a real ResizeObserver, neither
// of which happy-dom lays out. What is under test is the threshold, so the width
// is handed in through a ref the spec owns.
const observed = vi.hoisted(() => ({ width: null as { value: number } | null }));

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  const { shallowRef } = await import("vue");
  observed.width = shallowRef(0);
  return {
    ...actual,
    useElementSize: () => ({ width: observed.width, height: shallowRef(0), stop: () => {} }),
  };
});

function widthOf(px: number) {
  if (observed.width) observed.width.value = px;
  return useTableLayout(shallowRef<HTMLElement | null>(null));
}

// Re-stubbed rather than unstubbed between tests: this suite hands Nuxt's
// auto-imports over as globals in `test/setup.ts`, and `unstubAllGlobals` would
// take `computed` and `ref` away with it.
beforeEach(() => {
  vi.stubGlobal("getComputedStyle", () => ({ fontSize: "16px" }));
});

describe("useTableLayout", () => {
  it("answers neither table nor cards until something has been measured", () => {
    const { asTable, measured, width } = widthOf(0);
    expect(asTable.value).toBeNull();
    expect(measured.value).toBe(false);
    expect(width.value).toBe(0);
  });

  it("asks for the table from 64rem up", () => {
    expect(widthOf(1024).asTable.value).toBe(true);
    expect(widthOf(1600).asTable.value).toBe(true);
  });

  it("asks for the cards one pixel below it", () => {
    expect(widthOf(1023).asTable.value).toBe(false);
    expect(widthOf(390).asTable.value).toBe(false);
  });

  it("moves the threshold with the root font size rather than assuming 16px", () => {
    // 64rem at 20px is 1280, so a box that was wide enough a moment ago is not.
    vi.stubGlobal("getComputedStyle", () => ({ fontSize: "20px" }));
    expect(widthOf(1024).asTable.value).toBe(false);
    expect(widthOf(1280).asTable.value).toBe(true);
  });

  it("falls back to 16px when the root font size is unreadable", () => {
    // Without the fallback the threshold is NaN, every comparison is false and
    // the layout is pinned to the cards on any screen.
    vi.stubGlobal("getComputedStyle", () => ({ fontSize: "" }));
    expect(widthOf(1024).asTable.value).toBe(true);
    vi.stubGlobal("getComputedStyle", () => ({ fontSize: "0px" }));
    expect(widthOf(1024).asTable.value).toBe(true);
  });
});
