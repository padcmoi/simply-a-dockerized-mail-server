import { describe, it, expect, vi } from "vitest";
import { ref, reactive } from "vue";
import { useDomainBarChartData } from "~/composables/useDomainBarChartData";
import { useChartColors } from "~/composables/useChartColors";

// useChartColors is an auto-import; register the real one so it reads the
// stubbed useColorMode and the palette assertions stay honest.
function stubColors() {
  vi.stubGlobal("useColorMode", () => reactive({ value: "dark" }));
  vi.stubGlobal("useChartColors", useChartColors);
}

function mount(items: { domain: string; count: number }[]) {
  stubColors();
  return useDomainBarChartData(ref(items));
}

describe("useDomainBarChartData.chartHeight", () => {
  it("keeps a 120px floor for short lists", () => {
    expect(mount([]).chartHeight.value).toBe(120);
    expect(mount([{ domain: "a", count: 1 }]).chartHeight.value).toBe(120);
    // 2 rows -> 2*34 + 32 = 100, still under the floor.
    expect(
      mount([
        { domain: "a", count: 1 },
        { domain: "b", count: 2 },
      ]).chartHeight.value
    ).toBe(120);
  });

  it("grows 34px per row past the floor", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ domain: `d${i}`, count: i }));
    expect(mount(items).chartHeight.value).toBe(5 * 34 + 32);
  });
});

describe("useDomainBarChartData.chartData", () => {
  it("maps domains to labels and counts to the horizontal bar dataset", () => {
    const { chartData } = mount([
      { domain: "a.com", count: 5 },
      { domain: "b.com", count: 2 },
    ]);
    expect(chartData.value.labels).toEqual(["a.com", "b.com"]);
    const ds = chartData.value.datasets[0]!;
    expect(ds.data).toEqual([5, 2]);
    expect(ds.backgroundColor).toBe("rgba(96,165,250,0.35)");
    expect(ds.borderColor).toBe("#60a5fa");
  });

  it("recomputes labels and height when the items change", () => {
    const items = ref([{ domain: "a.com", count: 1 }]);
    stubColors();
    const { chartData, chartHeight } = useDomainBarChartData(items);
    expect(chartData.value.labels).toEqual(["a.com"]);
    items.value = Array.from({ length: 4 }, (_, i) => ({ domain: `x${i}`, count: i }));
    expect(chartData.value.labels).toEqual(["x0", "x1", "x2", "x3"]);
    expect(chartHeight.value).toBe(4 * 34 + 32);
  });
});

describe("useDomainBarChartData.chartOptions", () => {
  it("draws a horizontal axis and themes grid and ticks", () => {
    const { chartOptions } = mount([{ domain: "a.com", count: 1 }]);
    expect(chartOptions.value.indexAxis).toBe("y");
    expect(chartOptions.value.maintainAspectRatio).toBe(false);
    expect(chartOptions.value.scales?.x?.grid?.color).toBe("rgba(255,255,255,0.07)");
    expect(chartOptions.value.scales?.x?.ticks?.color).toBe("#9ca3af");
    expect(chartOptions.value.scales?.y?.ticks?.color).toBe("#9ca3af");
  });
});
