import { describe, it, expect } from "vitest";
import { occupancyPercent, occupancyColor } from "~/composables/useOccupancy";

describe("occupancyPercent", () => {
  it("returns the used share of the quota as a percent", () => {
    expect(occupancyPercent(1000, 500)).toBe(50);
    expect(occupancyPercent(1000, 250)).toBe(25);
    expect(occupancyPercent(1000, 1000)).toBe(100);
  });

  it("caps at 100 when the mailbox sits above its quota", () => {
    expect(occupancyPercent(1000, 2000)).toBe(100);
    expect(occupancyPercent(1000, 1001)).toBe(100);
  });

  it("reads as empty for a zero or negative quota rather than dividing by zero", () => {
    expect(occupancyPercent(0, 500)).toBe(0);
    expect(occupancyPercent(-1, 500)).toBe(0);
  });

  it("reads as empty for a non-finite quota", () => {
    expect(occupancyPercent(Number.NaN, 500)).toBe(0);
    expect(occupancyPercent(Number.POSITIVE_INFINITY, 500)).toBe(0);
  });

  it("is zero when nothing has been written", () => {
    expect(occupancyPercent(1000, 0)).toBe(0);
  });
});

describe("occupancyColor", () => {
  it("is error above 90 percent", () => {
    expect(occupancyColor(91)).toBe("error");
    expect(occupancyColor(100)).toBe("error");
  });

  it("is warning above 70 and up to 90 percent", () => {
    expect(occupancyColor(71)).toBe("warning");
    expect(occupancyColor(90)).toBe("warning");
  });

  it("is success at or below 70 percent", () => {
    expect(occupancyColor(70)).toBe("success");
    expect(occupancyColor(0)).toBe("success");
  });
});
