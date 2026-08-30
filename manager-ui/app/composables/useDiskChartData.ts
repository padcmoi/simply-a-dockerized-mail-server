import type { ChartData, ChartOptions } from "chart.js";

export function formatBytes(bytes: number) {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function useDiskChartData(input: Readonly<Ref<DiskInput | null>>) {
  const { t } = useI18n();
  const { colors } = useChartColors();

  const usedBytes = computed(() => Math.max(0, (input.value?.totalBytes ?? 0) - (input.value?.freeBytes ?? 0)));
  const reservedBytes = computed(() => Math.min(input.value?.reservedBytes ?? 0, input.value?.freeBytes ?? 0));
  const freeBytes = computed(() => Math.max(0, (input.value?.freeBytes ?? 0) - reservedBytes.value));

  const chartData = computed<ChartData<"doughnut">>(() => ({
    labels: [t("dashboard.disk.used"), t("dashboard.disk.reserved"), t("dashboard.disk.free")],
    datasets: [
      {
        data: [usedBytes.value, reservedBytes.value, freeBytes.value],
        backgroundColor: [colors.value.error, colors.value.warning, colors.value.success],
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  }));

  const chartOptions = computed<ChartOptions<"doughnut">>(() => ({
    responsive: true,
    maintainAspectRatio: true,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${formatBytes(ctx.parsed)}`,
        },
      },
    },
  }));

  return { chartData, chartOptions, usedBytes, reservedBytes, freeBytes };
}
