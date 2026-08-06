<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
import type { RspamdHistoryItem } from "~/composables/useRspamdPage";
definePageMeta({
  requiredGlobal: [
    { resource: "rspamd", action: "access" },
    { resource: "rspamd", action: "view-rspamd-stats" },
  ],
});

// Declared once for both renderings, which DataTable chooses between on its own
// width rather than this page carrying one of each.
const tableColumns = computed<DataTableColumn<RspamdHistoryItem>[]>(() => [
  { key: "sender_smtp", label: t("rspamdPage.col.from"), value: (row) => row.sender_smtp, primary: true },
  { key: "rcpt", label: t("rspamdPage.col.to"), value: (row) => row.rcpt },
  { key: "action", label: t("rspamdPage.col.action"), value: (row) => row.action },
  { key: "score", label: t("rspamdPage.col.score"), value: (row) => row.score },
  { key: "size", label: t("rspamdPage.col.size"), value: (row) => row.size },
  { key: "time", label: t("rspamdPage.col.time"), value: (row) => row.time },
]);

const {
  stats,
  historyItems,
  total,
  loading,
  historyLoading,
  historyHasLoadedOnce,
  statsUnavailable,
  page,
  limit,
  search,
  sortBy,
  sortDir,
} = useRspamdPage();
const { t } = useI18n();
const toast = useToast();
const { isRoot, hasGlobal } = usePermissions();
const { actions, actionsLoading, saveActions, resetActions } = useRspamdActions();

const bayesStatfiles = computed(() => stats.value?.statfiles ?? []);

// Stricter than the page's own gate: writing an arbitrary threshold can silently
// break spam filtering server-wide, see rspamd.controller.ts.
const canEditActions = computed(() => isRoot.value || hasGlobal("rspamd", "edit-rspamd-thresholds"));
// A separate permission on purpose: resetting only ever restores this project's
// shipped baseline, a bounded outcome, unlike an arbitrary save.
const canResetActions = computed(() => isRoot.value || hasGlobal("rspamd", "reset-rspamd-thresholds"));

async function onSaveActions(input: Parameters<typeof saveActions>[0]) {
  try {
    await saveActions(input);
    toast.add({ title: t("rspamdPage.actions.saved"), color: "success" });
  } catch (err) {
    toast.add({ title: t("rspamdPage.actions.saveFailed"), description: (err as Error).message, color: "error" });
  }
}

async function onResetActions() {
  try {
    await resetActions();
    toast.add({ title: t("rspamdPage.actions.resetDone"), color: "success" });
  } catch (err) {
    toast.add({ title: t("rspamdPage.actions.resetFailed"), description: (err as Error).message, color: "error" });
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-shield" :title="t('rspamdPage.subtitle')" />

    <RspamdStatTiles :stats="stats" :loading="loading" />

    <RspamdStatsCard :stats="stats" :loading="loading" :unavailable="statsUnavailable" />

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <RspamdActionsCard
        :actions="actions"
        :loading="actionsLoading"
        :can-edit="canEditActions"
        :can-reset="canResetActions"
        @save="onSaveActions"
        @reset="onResetActions"
      />
      <RspamdBayesCard :statfiles="bayesStatfiles" :loading="loading" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("rspamdPage.history.title") }}</h2>
      </template>

      <div v-if="!historyHasLoadedOnce" class="space-y-2">
        <USkeleton v-for="i in 5" :key="i" class="h-8 w-full" />
      </div>

      <DataTable
        v-else
        v-model:page="page"
        v-model:page-size="limit"
        v-model:search="search"
        v-model:sort-key="sortBy"
        v-model:sort-direction="sortDir"
        :data="historyItems"
        :columns="tableColumns"
        :total="total"
        :loading="historyLoading"
        :row-key="(row: RspamdHistoryItem) => row.id"
        :empty-label="t('rspamdPage.history.noData')"
      >
        <template #action="{ row }">
          <UBadge :color="rspamdActionColor(row.action)" variant="subtle" size="xs">{{ row.action }}</UBadge>
        </template>

        <template #score="{ row }">
          <span :class="row.score > row.required_score ? 'text-error' : 'text-success'">{{ row.score.toFixed(2) }}</span>
        </template>

        <template #size="{ row }">{{ formatBytes(row.size) }}</template>
      </DataTable>
    </UCard>
  </div>
</template>
