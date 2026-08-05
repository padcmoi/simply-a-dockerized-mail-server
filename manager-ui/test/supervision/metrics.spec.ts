import { describe, it, expect } from "vitest";
import { bitsPerSecond, metricAlert, metricCeiling, metricKnown, preciseBytes, BUSY, SATURATED } from "~/utils/metrics";

describe("metricAlert", () => {
  it("says nothing at all below the busy threshold, since an outline always on says nothing", () => {
    expect(metricAlert(0)).toBeNull();
    expect(metricAlert(BUSY - 0.01)).toBeNull();
  });

  it("warns from the busy threshold and errors from the saturated one", () => {
    expect(metricAlert(BUSY)?.color).toBe("warning");
    expect(metricAlert(SATURATED)?.color).toBe("error");
    expect(metricAlert(1.5)?.color).toBe("error");
  });

  // The API serves its own with the live window, and they are the ones it
  // notifies on: what a card outlines in red is what raises a notification.
  it("reads the thresholds it is handed rather than the ones it ships with", () => {
    const served = { busy: 0.4, saturated: 0.5 };
    expect(metricAlert(0.45, served)?.color).toBe("warning");
    expect(metricAlert(0.5, served)?.color).toBe("error");
    expect(metricAlert(0.39, served)).toBeNull();
  });

  it("says nothing about a ratio it does not have", () => {
    expect(metricAlert(null)).toBeNull();
  });

  // The card ships its own ring-default: without the `!` which of the two wins
  // depends on the order the stylesheet happens to emit them in.
  it("marks the outline as the one that must win over the card's own ring", () => {
    expect(metricAlert(1)?.ring).toContain("!");
  });
});

describe("metricKnown", () => {
  it("counts only the moments that carry a figure", () => {
    expect(metricKnown([1, null, 2, null])).toBe(2);
    expect(metricKnown([null, null])).toBe(0);
  });
});

describe("metricCeiling", () => {
  // A CPU at 2 % drawn against 100 % is a flat line on the floor.
  it("fits the box to the window with a fifth of headroom", () => {
    expect(metricCeiling([10, 20, 50], 1)).toBe(60);
  });

  it("never scales an idle machine below its floor, so its own noise is not magnified", () => {
    expect(metricCeiling([0.1], 10)).toBe(10);
    expect(metricCeiling([], 10)).toBe(10);
  });

  // A null is a moment with no figure, not a zero.
  it("ignores the holes when looking for the peak", () => {
    expect(metricCeiling([null, 50, null], 1)).toBe(60);
  });
});

describe("bitsPerSecond", () => {
  // A link is sold and read in bits, while /proc counts the bytes through it.
  it("reads bytes as the bits a link is measured in", () => {
    expect(bitsPerSecond(1000)).toBe("8.0 kb/s");
    expect(bitsPerSecond(0)).toBe("0.0 b/s");
  });

  it("drops the decimal past ten, where it stops meaning anything", () => {
    expect(bitsPerSecond(2_000)).toBe("16 kb/s");
    expect(bitsPerSecond(1_000_000_000)).toBe("8.0 Gb/s");
  });
});

describe("preciseBytes", () => {
  // 24 616 660 992 bytes is 24.6 GB, and rounding it to 25 GB makes the card
  // argue with the invoice.
  it("keeps one decimal whatever the scale", () => {
    expect(preciseBytes(24_616_660_992)).toBe("24.6 GB");
    expect(preciseBytes(101_800_000_000)).toBe("101.8 GB");
  });

  it("writes plain bytes without a decimal that would mean nothing", () => {
    expect(preciseBytes(512)).toBe("512 B");
  });
});
