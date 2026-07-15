import { describe, it, expect } from "vitest";
import { useDataRefresh } from "~/composables/useDataRefresh";

// `tick` is backed by useState (a ref in the test harness). bump() is the only
// state transition: a monotonic counter pages watch to reload their own data.
describe("useDataRefresh", () => {
  it("starts the tick at 0", () => {
    const { tick } = useDataRefresh();
    expect(tick.value).toBe(0);
  });

  it("bump increments the tick", () => {
    const { tick, bump } = useDataRefresh();
    bump();
    expect(tick.value).toBe(1);
    bump();
    bump();
    expect(tick.value).toBe(3);
  });
});
