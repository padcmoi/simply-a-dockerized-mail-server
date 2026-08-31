<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";
import { formatBytes } from "~/composables/useDiskChartData";

const props = defineProps<{ totalBytes: number; usedBytes: number }>();

const { t } = useI18n();
const { colors } = useChartColors();

const used = computed(() => Math.max(0, Math.min(props.usedBytes, props.totalBytes)));
const free = computed(() => Math.max(0, props.totalBytes - used.value));

const chartData = computed<ChartData<"doughnut">>(() => ({
  labels: [t("dashboard.disk.used"), t("dashboard.disk.free")],
  datasets: [
    {
      data: [used.value, free.value],
      backgroundColor: [colors.value.error, colors.value.success],
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
    tooltip: { callbacks: { label: (ctx) => ` ${formatBytes(ctx.parsed)}` } },
  },
}));
</script>

<template>
  <div class="flex flex-col sm:flex-row items-center gap-6">
    <div class="relative shrink-0 w-36 h-36">
      <DoughnutChart :data="chartData" :options="chartOptions" />
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span class="text-xs text-muted font-medium">{{ formatBytes(used) }}</span>
        <span class="text-[10px] text-dimmed">/ {{ formatBytes(totalBytes) }}</span>
      </div>
    </div>

    <ul class="space-y-2 text-sm min-w-0">
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-error shrink-0" />
        <span class="text-muted">{{ t("dashboard.disk.used") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(used) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-success shrink-0" />
        <span class="text-muted">{{ t("dashboard.disk.free") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(free) }}</span>
      </li>
    </ul>
  </div>
</template>
