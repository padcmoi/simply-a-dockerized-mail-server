<script setup lang="ts">
const { t } = useI18n();
const { call } = useApi();
const { formatDateTime } = useDateTime();
const toast = useToast();

const RESULT_COLOR = { success: "success", partial: "warning", failed: "error" } as const;

const logOpen = ref(false);
const log = ref<BackupRunLog | null>(null);
const logLoading = ref(false);

const columns = computed<DataTableColumn<BackupRun>[]>(() => [
  { key: "startedAt", label: t("backups.runs.startedAt"), value: (row) => row.startedAt, primary: true, searchable: false },
  { key: "result", label: t("backups.runs.result"), value: (row) => row.result },
  { key: "outageSeconds", label: t("backups.runs.outage"), value: (row) => row.outageSeconds, searchable: false },
  { key: "durationSeconds", label: t("backups.runs.duration"), value: (row) => row.durationSeconds, searchable: false },
  { key: "archiveBytes", label: t("backups.runs.archive"), value: (row) => row.archiveBytes, searchable: false },
  { key: "error", label: t("backups.runs.error"), value: (row) => row.error, sortable: false },
]);

const { items, total, loading, hasLoadedOnce, page, limit, search, sortBy, sortDir } = usePaginatedList<BackupRun>(
  "backup-runs",
  () => "/backups/runs",
  "startedAt"
);

async function showLog(row: BackupRun) {
  logOpen.value = true;
  logLoading.value = true;
  log.value = null;
  try {
    log.value = await call<BackupRunLog>(`/backups/runs/${row.id}/log`);
  } catch {
    logOpen.value = false;
    toast.add({ title: t("backups.runs.logFailed"), color: "error" });
  } finally {
    logLoading.value = false;
  }
}
</script>

<template>
  <div class="min-w-0">
    <ListSkeleton v-if="!hasLoadedOnce" :columns="5" />

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      table-id="backup-runs"
      :data="items"
      :columns="columns"
      :total="total"
      :loading="loading"
      :row-key="(row: BackupRun) => row.id"
      :empty-label="t('backups.runs.empty')"
    >
      <template #startedAt="{ row }">
        <span class="whitespace-nowrap">{{ formatDateTime(row.startedAt) }}</span>
      </template>
      <template #result="{ row }">
        <UBadge :color="RESULT_COLOR[row.result]" variant="subtle">{{ t(`backups.result.${row.result}`) }}</UBadge>
      </template>
      <template #outageSeconds="{ row }">
        <span class="whitespace-nowrap">{{ formatElapsed(row.outageSeconds) }}</span>
      </template>
      <template #durationSeconds="{ row }">
        <span class="whitespace-nowrap">{{ formatElapsed(row.durationSeconds) }}</span>
      </template>
      <template #archiveBytes="{ row }">
        <span v-if="row.archive" class="whitespace-nowrap">{{ formatBytes(row.archiveBytes) }}</span>
        <span v-else class="text-muted">-</span>
      </template>
      <template #error="{ row }">
        <FullTooltip v-if="row.error" :text="row.error">
          <span class="text-error">{{ truncateChars(row.error, 40) }}</span>
        </FullTooltip>
        <span v-else class="text-muted">-</span>
      </template>
      <template #actions="{ row }">
        <UButton icon="i-lucide-scroll-text" color="neutral" variant="outline" size="xs" @click="showLog(row)">
          {{ t("backups.runs.log") }}
        </UButton>
      </template>
    </DataTable>

    <UModal
      v-model:open="logOpen"
      :title="t('backups.runs.logTitle')"
      :description="log ? formatDateTime(log.startedAt) : ''"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body>
        <div v-if="logLoading" class="space-y-2">
          <USkeleton v-for="line in 6" :key="line" class="h-4 w-full" />
        </div>
        <pre v-else-if="log" class="max-h-[60vh] overflow-auto text-xs whitespace-pre-wrap break-words">{{
          log.lines.map((line) => logLineInZone(line)).join("\n")
        }}</pre>
      </template>
    </UModal>
  </div>
</template>
