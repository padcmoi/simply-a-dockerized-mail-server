<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";
import { rspamdActionColor, useRspamdPage } from "~/composables/useRspamdPage";

definePageMeta({
  requiredGlobal: [
    { resource: "rspamd", action: "access" },
    { resource: "rspamd", action: "read" },
  ],
});

interface HistoryRow {
  id: string;
  sender_smtp: string;
  rcpt: string;
  action: string;
  score: number;
  required_score: number;
  size: number;
  time: string;
}

const donutData = computed<ChartData<"doughnut">>(() => {
  const dark = colorMode.value === "dark";
  const successColor = dark ? "#4ade80" : "#22c55e";
  const errorColor = dark ? "#f87171" : "#ef4444";
  const warningColor = dark ? "#fbbf24" : "#f59e0b";
  const primaryColor = dark ? "#60a5fa" : "#3b82f6";
  if (!stats.value) return { labels: [], datasets: [{ data: [], borderWidth: 0 }] };
  const a = stats.value.actions;
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
          const pct = stats.value && stats.value.scanned > 0 ? ((val / stats.value.scanned) * 100).toFixed(1) : "0";
          return ` ${val} (${pct}%)`;
        },
      },
    },
  },
}));

const legendItems = computed(() => {
  if (!stats.value) return [];
  const a = stats.value.actions;
  return [
    { label: "no action", value: a["no action"], color: "bg-success" },
    { label: "reject", value: a.reject, color: "bg-error" },
    { label: "add header", value: a["add header"], color: "bg-warning" },
    { label: "soft reject", value: a["soft reject"], color: "bg-warning" },
    { label: "greylist", value: a.greylist, color: "bg-primary" },
  ].filter((i) => i.value > 0);
});

const tableColumns = computed(() => [
  { accessorKey: "sender_smtp", header: t("rspamdPage.col.from") },
  { accessorKey: "rcpt", header: t("rspamdPage.col.to") },
  { id: "action", header: t("rspamdPage.col.action") },
  { id: "score", header: t("rspamdPage.col.score") },
  { id: "size", header: t("rspamdPage.col.size") },
  { accessorKey: "time", header: t("rspamdPage.col.time") },
]);

const tableRows = computed<HistoryRow[]>(() =>
  history.value.map((r) => ({
    id: r["message-id"],
    sender_smtp: r.sender_smtp,
    rcpt: r.rcpt_smtp?.join(", ") ?? "",
    action: r.action,
    score: r.score,
    required_score: r.required_score,
    size: r.size,
    time: new Date(r.unix_time * 1000).toLocaleString(),
  }))
);

const {
  stats,
  history,
  total,
  loading,
  historyLoading,
  historyHasLoadedOnce,
  statsUnavailable,
  page,
  limit,
  search,
  sortDir,
  load,
} = useRspamdPage();
const colorMode = useColorMode();
const { t } = useI18n();
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-shield"
        :title="t('rspamdPage.subtitle')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UAlert
      v-if="statsUnavailable"
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
          <ChartsDoughnutChart :data="donutData" :options="donutOptions" />
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

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("rspamdPage.history.title") }}</h2>
      </template>

      <div class="mb-4">
        <ListToolbar v-model:search="search" v-model:limit="limit" v-model:sort-dir="sortDir" />
      </div>

      <div v-if="!historyHasLoadedOnce" class="space-y-2">
        <USkeleton v-for="i in 5" :key="i" class="h-8 w-full" />
      </div>
      <p v-else-if="history.length === 0" class="text-sm text-muted text-center py-8">
        {{ t("rspamdPage.history.noData") }}
      </p>
      <div v-else class="overflow-x-auto">
        <UTable :columns="tableColumns" :data="tableRows" :loading="historyLoading">
          <template #action-cell="{ row }">
            <UBadge :color="rspamdActionColor(row.original.action)" variant="subtle" size="xs">
              {{ row.original.action }}
            </UBadge>
          </template>
          <template #score-cell="{ row }">
            <span :class="row.original.score > row.original.required_score ? 'text-error' : 'text-success'">
              {{ row.original.score.toFixed(2) }}
            </span>
          </template>
          <template #size-cell="{ row }">
            {{ formatBytes(row.original.size) }}
          </template>
        </UTable>
      </div>

      <div class="mt-4">
        <ListPagination v-model:page="page" :total="total" :limit="limit" />
      </div>
    </UCard>
  </div>
</template>
