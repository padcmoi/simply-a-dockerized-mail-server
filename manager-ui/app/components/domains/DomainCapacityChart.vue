<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";

const props = defineProps<{
  reserved: number;
  assignable: number;
  pending: number;
}>();

const { t } = useI18n();
const { colors } = useChartColors();

// The pool a new domain draws from: what the existing domains hold plus what
// is left. Deliberately not the volume's total size -- mail is not the only
// thing on that disk, and the bytes it cannot claim would drown every slice.
const allocatableBytes = computed(() => props.reserved + Math.max(0, props.assignable));

// Capped at what the volume can still grant: past that the API refuses anyway,
// and an oversized slice would rescale the others instead of showing overflow.
const pendingBytes = computed(() => Math.min(Math.max(0, props.pending), Math.max(0, props.assignable)));

const remainingBytes = computed(() => Math.max(0, props.assignable - pendingBytes.value));

const chartData = computed<ChartData<"doughnut">>(() => ({
  labels: [t("domains.capacity.reserved"), t("domains.chart.pending"), t("domains.capacity.assignable")],
  datasets: [
    {
      data: [props.reserved, pendingBytes.value, remainingBytes.value],
      backgroundColor: [colors.value.warning, colors.value.primary, colors.value.success],
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
  <div class="flex flex-col items-center gap-6">
    <div class="relative shrink-0 w-40 h-40">
      <DoughnutChart :data="chartData" :options="chartOptions" />
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span class="text-sm text-muted font-medium">{{ formatBytes(pendingBytes) }}</span>
        <span class="text-[10px] text-dimmed">/ {{ formatBytes(allocatableBytes) }}</span>
      </div>
    </div>

    <ul class="space-y-2 text-sm w-full min-w-0">
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-warning shrink-0" />
        <span class="text-muted">{{ t("domains.capacity.reserved") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(reserved) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-primary shrink-0" />
        <span class="text-muted">{{ t("domains.chart.pending") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(pendingBytes) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-success shrink-0" />
        <span class="text-muted">{{ t("domains.capacity.assignable") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(remainingBytes) }}</span>
      </li>
      <li class="flex items-center gap-2 border-t border-default pt-2">
        <span class="text-muted">{{ t("domains.capacity.allocatable") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(allocatableBytes) }}</span>
      </li>
    </ul>
  </div>
</template>
