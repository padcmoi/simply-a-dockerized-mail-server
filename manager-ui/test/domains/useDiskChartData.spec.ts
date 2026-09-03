import { describe, it, expect, vi } from "vitest";
import { ref, reactive } from "vue";
import { useDiskChartData } from "~/composables/useDiskChartData";
import { useChartColors } from "~/composables/useChartColors";

// formatBytes moved to ~/utils/bytes, and its own suite with it.
describe("useDiskChartData", () => {
  function mount(input: { totalBytes: number; freeBytes: number; reservedBytes: number } | null) {
    // useChartColors is an auto-import; register the real one so it reads the
    // stubbed useColorMode and the palette assertions stay honest.
    vi.stubGlobal("useColorMode", () => reactive({ value: "dark" }));
    vi.stubGlobal("useChartColors", useChartColors);
    return useDiskChartData(ref(input));
  }

  it("derives used, reserved and free from a disk snapshot", () => {
    const { usedBytes, reservedBytes, freeBytes } = mount({
      totalBytes: 1000,
      freeBytes: 400,
      reservedBytes: 100,
    });
    expect(usedBytes.value).toBe(600);
    expect(reservedBytes.value).toBe(100);
    expect(freeBytes.value).toBe(300);
  });

  it("clamps reserved to the free space and never lets free go negative", () => {
    const { usedBytes, reservedBytes, freeBytes } = mount({
      totalBytes: 1000,
      freeBytes: 200,
      reservedBytes: 500,
    });
    expect(usedBytes.value).toBe(800);
    expect(reservedBytes.value).toBe(200);
    expect(freeBytes.value).toBe(0);
  });

  it("clamps used at zero when free exceeds total", () => {
    const { usedBytes } = mount({ totalBytes: 100, freeBytes: 400, reservedBytes: 0 });
    expect(usedBytes.value).toBe(0);
  });

  it("reads a null snapshot as all-zero", () => {
    const { usedBytes, reservedBytes, freeBytes } = mount(null);
    expect(usedBytes.value).toBe(0);
    expect(reservedBytes.value).toBe(0);
    expect(freeBytes.value).toBe(0);
  });

  it("feeds the doughnut dataset in used/reserved/free order with the dark palette", () => {
    const { chartData } = mount({ totalBytes: 1000, freeBytes: 400, reservedBytes: 100 });
    const ds = chartData.value.datasets[0]!;
    expect(ds.data).toEqual([600, 100, 300]);
    expect(ds.backgroundColor).toEqual(["#f87171", "#fbbf24", "#4ade80"]);
    expect(chartData.value.labels).toEqual(["dashboard.disk.used", "dashboard.disk.reserved", "dashboard.disk.free"]);
  });

  it("formats tooltip values through formatBytes", () => {
    const { chartOptions } = mount({ totalBytes: 1000, freeBytes: 400, reservedBytes: 100 });
    const label = chartOptions.value.plugins?.tooltip?.callbacks?.label as (ctx: { parsed: number }) => string;
    expect(label({ parsed: 1_048_576 })).toBe(" 1 MB");
    expect(chartOptions.value.cutout).toBe("72%");
  });
});
