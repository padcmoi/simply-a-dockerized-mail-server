<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";
import { RSPAMD_ACTION_STYLE } from "~/composables/useRspamdPage";

const props = defineProps<{
  stats: RspamdStats | null;
  loading: boolean;
  unavailable: boolean;
}>();

const { colors } = useChartColors();
const { t } = useI18n();

// The verdicts in the order they are drawn, each carrying the one colour it
// wears everywhere else on the page (RSPAMD_ACTION_STYLE).
const ACTIONS = ["no action", "reject", "add header", "rewrite subject", "soft reject", "greylist"] as const;

const donutData = computed<ChartData<"doughnut">>(() => {
  if (!props.stats) return { labels: [], datasets: [{ data: [], borderWidth: 0 }] };
  const a = props.stats.actions;
  return {
    labels: [...ACTIONS],
    datasets: [
      {
        data: ACTIONS.map((action) => a[action]),
        backgroundColor: ACTIONS.map((action) => colors.value[RSPAMD_ACTION_STYLE[action].chart]),
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
  return ACTIONS.map((action) => ({
    label: action,
    value: a[action],
    color: RSPAMD_ACTION_STYLE[action].dot,
  })).filter((i) => i.value > 0);
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
    <div v-if="loading && !stats" class="flex flex-col sm:flex-row items-center justify-center gap-6">
      <USkeleton class="shrink-0 w-40 h-40 rounded-full" />
      <div class="space-y-2 w-full sm:w-64">
        <USkeleton v-for="i in 5" :key="i" class="h-4 w-full" />
      </div>
    </div>
    <div v-else-if="stats" class="flex flex-col sm:flex-row items-center justify-center gap-6">
      <div class="relative shrink-0 w-40 h-40">
        <DoughnutChart :data="donutData" :options="donutOptions" />
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span class="text-2xl font-bold">{{ stats.scanned.toLocaleString() }}</span>
          <span class="text-xs text-muted">{{ t("domainDashboard.rspamd.scanned") }}</span>
        </div>
      </div>
      <ul class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-2 text-sm min-w-0 w-full sm:w-64">
        <li v-for="item in legendItems" :key="item.label" class="contents">
          <span class="w-3 h-3 rounded-sm" :class="item.color" />
          <span class="text-muted">{{ item.label }}</span>
          <span class="font-medium text-right">{{ item.value.toLocaleString() }}</span>
          <span class="text-dimmed text-xs text-right">
            {{ stats.scanned > 0 ? ((item.value / stats.scanned) * 100).toFixed(1) : "0" }}%
          </span>
        </li>
      </ul>
    </div>
  </UCard>
</template>
