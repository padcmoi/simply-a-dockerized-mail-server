<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "rspamd", action: "access" },
    { resource: "rspamd", action: "view-rspamd-stats" },
  ],
});

// Same source feeds the desktop column headers below and ListToolbar's
// mobile sort select.
const SORTABLE_COLUMNS = computed(() => [
  { key: "sender_smtp", label: t("rspamdPage.col.from") },
  { key: "rcpt", label: t("rspamdPage.col.to") },
  { key: "action", label: t("rspamdPage.col.action") },
  { key: "score", label: t("rspamdPage.col.score") },
  { key: "size", label: t("rspamdPage.col.size") },
  { key: "time", label: t("rspamdPage.col.time") },
]);

const tableColumns = computed(() => [
  { accessorKey: "sender_smtp", header: header("sender_smtp", t("rspamdPage.col.from")) },
  { accessorKey: "rcpt", header: header("rcpt", t("rspamdPage.col.to")) },
  { id: "action", header: header("action", t("rspamdPage.col.action")) },
  { id: "score", header: header("score", t("rspamdPage.col.score")) },
  { id: "size", header: header("size", t("rspamdPage.col.size")) },
  { accessorKey: "time", header: header("time", t("rspamdPage.col.time")) },
]);

const { domainId, domainFqdn } = useCurrentDomain();
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
  load,
} = useRspamdPage(domainId);
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);
const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: domainFqdn.value, to: `/domains/${domainFqdn.value}` },
    { label: t("nav.rspamd") },
  ]);
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-shield"
        :title="t('domainDashboard.rspamdPage.subtitle')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <RspamdStatTiles :stats="stats" :loading="loading" />

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <RspamdStatsCard :stats="stats" :loading="loading" :unavailable="statsUnavailable" />
      <RspamdDomainBayesCard :bayes="stats?.bayes" :loading="loading" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("rspamdPage.history.title") }}</h2>
      </template>

      <div class="mb-4">
        <ListToolbar
          v-model:search="search"
          v-model:limit="limit"
          v-model:sort-by="sortBy"
          v-model:sort-dir="sortDir"
          :sortable-columns="SORTABLE_COLUMNS"
        />
      </div>

      <div v-if="!historyHasLoadedOnce" class="space-y-2">
        <USkeleton v-for="i in 5" :key="i" class="h-8 w-full" />
      </div>
      <p v-else-if="historyItems.length === 0" class="text-sm text-muted text-center py-8">
        {{ t("rspamdPage.history.noData") }}
      </p>
      <template v-else>
        <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden xl:block">
          <UTable :columns="tableColumns" :data="historyItems" :loading="historyLoading">
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
        </UCard>

        <div class="xl:hidden space-y-3">
          <RspamdHistoryCard v-for="item in historyItems" :key="item.id" :item="item" />
        </div>
      </template>

      <div class="mt-4">
        <ListPagination v-model:page="page" :total="total" :limit="limit" />
      </div>
    </UCard>
  </div>
</template>
