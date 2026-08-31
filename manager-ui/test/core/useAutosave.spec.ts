import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAutosave } from "~/composables/useAutosave";

// useAutosave imports useDebounceFn statically from @vueuse/core (the real one,
// not the identity stub in setup.ts), so drive it with fake timers.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useAutosave", () => {
  it("coalesces bursts into a single trailing call after the delay", () => {
    const fn = vi.fn();
    const save = useAutosave(fn, 500);
    save();
    save();
    save();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("defaults to a 1000ms debounce window", () => {
    const fn = vi.fn();
    const save = useAutosave(fn);
    save();
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("restarts the timer on every new call", () => {
    const fn = vi.fn();
    const save = useAutosave(fn, 500);
    save();
    vi.advanceTimersByTime(300);
    save();
    // 300ms after the second call: total 600ms elapsed, but the window reset.
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
