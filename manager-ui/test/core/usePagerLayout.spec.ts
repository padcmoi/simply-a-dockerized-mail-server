import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePagerLayout } from "~/composables/usePagerLayout";

beforeEach(() => {
  vi.stubGlobal("getComputedStyle", () => ({ fontSize: "16px" }));
});

describe("usePagerLayout", () => {
  it("keeps the pager to the current page and its chevrons until a width is measured", () => {
    const getComputedStyle = vi.fn(() => ({ fontSize: "16px" }));
    vi.stubGlobal("getComputedStyle", getComputedStyle);
    const { showEdges, siblingCount } = usePagerLayout(0);
    expect(showEdges.value).toBe(false);
    expect(siblingCount.value).toBe(0);
    expect(getComputedStyle).not.toHaveBeenCalled();
  });

  it("stays compact below 32rem, and shows the first and last pages with one neighbour from 32rem up", () => {
    expect(usePagerLayout(511).siblingCount.value).toBe(0);
    expect(usePagerLayout(511).showEdges.value).toBe(false);
    expect(usePagerLayout(512).siblingCount.value).toBe(1);
    expect(usePagerLayout(512).showEdges.value).toBe(true);
  });

  it("follows the reader's text size, and a width that changes", () => {
    vi.stubGlobal("getComputedStyle", () => ({ fontSize: "20px" }));
    expect(usePagerLayout(600).showEdges.value).toBe(false);
    expect(usePagerLayout(640).showEdges.value).toBe(true);

    const width = ref(700);
    const { showEdges } = usePagerLayout(width);
    expect(showEdges.value).toBe(true);
    width.value = 300;
    expect(showEdges.value).toBe(false);
  });
});
