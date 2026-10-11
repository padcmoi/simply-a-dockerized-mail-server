import { describe, it, expect } from "vitest";
import { usePageFold } from "~/composables/usePageFold";

describe("usePageFold", () => {
  it("offers nothing to unfold on a page that folds nothing", () => {
    const { open, available, flagged } = usePageFold();
    expect(available.value).toBe(false);
    expect(open.value).toBe(false);
    expect(flagged.value).toBe(false);
  });

  it("is there to unfold as soon as a page folds its opening, and starts closed", () => {
    const { open, available, register } = usePageFold();
    register();
    expect(available.value).toBe(true);
    expect(open.value).toBe(false);
  });

  it("opens and closes from the button", () => {
    const { open, register, toggle, close } = usePageFold();
    register();
    toggle();
    expect(open.value).toBe(true);
    toggle();
    expect(open.value).toBe(false);
    toggle();
    close();
    expect(open.value).toBe(false);
  });

  it("flags a filter that is set while the fold hides it, and only then", () => {
    const { filtered, flagged, register, toggle } = usePageFold();
    register();
    expect(flagged.value).toBe(false);
    filtered.value = true;
    expect(flagged.value).toBe(true);
    toggle();
    expect(flagged.value).toBe(false);
    toggle();
    expect(flagged.value).toBe(true);
  });

  it("closes and forgets the filter once the page that folded is gone", () => {
    const { open, filtered, available, flagged, register, release, toggle } = usePageFold();
    register();
    filtered.value = true;
    toggle();
    release();
    expect(available.value).toBe(false);
    expect(open.value).toBe(false);
    expect(filtered.value).toBe(false);
    expect(flagged.value).toBe(false);
  });

  it("stays available while another fold of the page is still there", () => {
    const { open, available, register, release, toggle } = usePageFold();
    register();
    register();
    toggle();
    release();
    expect(available.value).toBe(true);
    expect(open.value).toBe(true);
    release();
    release();
    expect(available.value).toBe(false);
  });
});
