<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";

const props = defineProps<{
  domainQuota: number;
  allocated: number;
  available: number;
  pending: number;
}>();

const { t } = useI18n();
const { colors } = useChartColors();

// A domain whose recipients were overcommitted before the quota rule existed
// reports a negative headroom; chart.js would drop the slice silently, so the
// clamp makes it read as "nothing left to give", which is what it means.
const availableBytes = computed(() => Math.max(0, props.available));

// The quota currently typed in the form, capped at what the domain can grant:
// past that the value is refused anyway, and an oversized slice would push the
// others out of proportion instead of showing the overflow.
const pendingBytes = computed(() => Math.min(Math.max(0, props.pending), availableBytes.value));

const remainingBytes = computed(() => Math.max(0, availableBytes.value - pendingBytes.value));

// Three slices adding up to the domain's own quota: what its other recipients
// have already reserved, what this form is about to claim, and what would be
// left afterwards. Actual disk usage is deliberately absent -- a new mailbox
// competes for reservations, not for bytes already written.
const chartData = computed<ChartData<"doughnut">>(() => ({
  labels: [t("domainDashboard.disk.reserved"), t("recipients.chart.pending"), t("domainDashboard.disk.assignable")],
  datasets: [
    {
      data: [props.allocated, pendingBytes.value, remainingBytes.value],
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
        <span class="text-[10px] text-dimmed">/ {{ formatBytes(domainQuota) }}</span>
      </div>
    </div>

    <ul class="space-y-2 text-sm w-full min-w-0">
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-warning shrink-0" />
        <span class="text-muted">{{ t("domainDashboard.disk.reserved") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(allocated) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-primary shrink-0" />
        <span class="text-muted">{{ t("recipients.chart.pending") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(pendingBytes) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-success shrink-0" />
        <span class="text-muted">{{ t("domainDashboard.disk.assignable") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(remainingBytes) }}</span>
      </li>
      <li class="flex items-center gap-2 border-t border-default pt-2">
        <span class="text-muted">{{ t("domainDashboard.disk.allocated") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(domainQuota) }}</span>
      </li>
    </ul>
  </div>
</template>
