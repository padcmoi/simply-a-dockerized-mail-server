<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";
import type { RspamdStats } from "~/composables/useRspamdPage";

const props = defineProps<{
  stats: RspamdStats | null;
  loading: boolean;
  unavailable: boolean;
}>();

const colorMode = useColorMode();
const { t } = useI18n();

const donutData = computed<ChartData<"doughnut">>(() => {
  const dark = colorMode.value === "dark";
  const successColor = dark ? "#4ade80" : "#22c55e";
  const errorColor = dark ? "#f87171" : "#ef4444";
  const warningColor = dark ? "#fbbf24" : "#f59e0b";
  const primaryColor = dark ? "#60a5fa" : "#3b82f6";
  if (!props.stats) return { labels: [], datasets: [{ data: [], borderWidth: 0 }] };
  const a = props.stats.actions;
  return {
    labels: ["no action", "reject", "add header", "soft reject", "greylist"],
    datasets: [
      {
        data: [a["no action"], a.reject, a["add header"], a["soft reject"], a.greylist],
        backgroundColor: [successColor, errorColor, warningColor, warningColor, primaryColor],
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };
});

const donutOptions = computed<ChartOptions<"doughnut">>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  cutout: "72%",
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const val = ctx.parsed as number;
          const pct = props.stats && props.stats.scanned > 0 ? ((val / props.stats.scanned) * 100).toFixed(1) : "0";
          return ` ${val} (${pct}%)`;
        },
      },
    },
  },
}));

const legendItems = computed(() => {
  if (!props.stats) return [];
  const a = props.stats.actions;
  return [
    { label: "no action", value: a["no action"], color: "bg-success" },
    { label: "reject", value: a.reject, color: "bg-error" },
    { label: "add header", value: a["add header"], color: "bg-warning" },
    { label: "soft reject", value: a["soft reject"], color: "bg-warning" },
    { label: "greylist", value: a.greylist, color: "bg-primary" },
  ].filter((i) => i.value > 0);
});
</script>

<template>
  <UAlert
    v-if="unavailable"
    color="warning"
    variant="subtle"
    icon="i-lucide-alert-triangle"
    :title="t('domainDashboard.rspamd.unavailable')"
  />

  <UCard v-else>
    <template v-if="stats" #header>
      <h2 class="font-semibold">{{ t("domainDashboard.rspamd.title") }}</h2>
    </template>
    <div v-if="loading && !stats" class="flex flex-col sm:flex-row items-center gap-6">
      <USkeleton class="shrink-0 w-40 h-40 rounded-full" />
      <div class="space-y-2 w-full">
        <USkeleton v-for="i in 5" :key="i" class="h-4 w-full" />
      </div>
    </div>
    <div v-else-if="stats" class="flex flex-col sm:flex-row items-center gap-6">
      <div class="relative shrink-0 w-40 h-40">
        <DoughnutChart :data="donutData" :options="donutOptions" />
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span class="text-2xl font-bold">{{ stats.scanned.toLocaleString() }}</span>
          <span class="text-xs text-muted">{{ t("domainDashboard.rspamd.scanned") }}</span>
        </div>
      </div>
      <ul class="space-y-2 text-sm min-w-0 flex-1">
        <li v-for="item in legendItems" :key="item.label" class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-sm shrink-0" :class="item.color" />
          <span class="text-muted">{{ item.label }}</span>
          <span class="font-medium ml-auto pl-4">{{ item.value.toLocaleString() }}</span>
          <span class="text-dimmed text-xs w-12 text-right">
            {{ stats.scanned > 0 ? ((item.value / stats.scanned) * 100).toFixed(1) : "0" }}%
          </span>
        </li>
      </ul>
    </div>
  </UCard>
</template>
