import type { ChartData, ChartOptions } from "chart.js";

interface BarItem {
  domain: string;
  count: number;
}

export function useDomainBarChartData(items: Readonly<Ref<BarItem[]>>) {
  const { colors } = useChartColors();

  const chartHeight = computed(() => Math.max(120, items.value.length * 34 + 32));

  const chartData = computed<ChartData<"bar">>(() => ({
    labels: items.value.map((i) => i.domain),
    datasets: [
      {
        data: items.value.map((i) => i.count),
        backgroundColor: colors.value.primaryBg,
        borderColor: colors.value.primary,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }));

  const chartOptions = computed<ChartOptions<"bar">>(() => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: {
        grid: { color: colors.value.gridLine },
        ticks: { color: colors.value.textMuted },
      },
      y: {
        grid: { display: false },
        ticks: { color: colors.value.textMuted },
      },
    },
  }));

  return { chartData, chartOptions, chartHeight };
}
