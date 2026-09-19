<script setup lang="ts">
const { history } = defineProps<{ history: Fail2banHistoryEntry[] }>();

const { t, locale } = useI18n();

const sortKey = ref("bannedAt");
const sortDirection = ref<"asc" | "desc">("desc");
const opened = shallowRef<Fail2banHistoryEntry | null>(null);
const open = computed({
  get: () => opened.value !== null,
  set: (value: boolean) => {
    if (!value) opened.value = null;
  },
});

const columns = computed<DataTableColumn<Fail2banHistoryEntry>[]>(() => [
  { key: "bannedAt", label: t("fail2ban.col.bannedAt"), value: (row) => row.bannedAt, searchable: false },
  { key: "ip", label: t("fail2ban.col.ip"), value: (row) => row.ip, primary: true },
  { key: "jail", label: t("fail2ban.col.jail"), value: (row) => row.jail },
  {
    key: "expiresAt",
    label: t("fail2ban.col.expiresAt"),
    value: (row) => row.expiresAt ?? Number.MAX_SAFE_INTEGER,
    searchable: false,
  },
  { key: "failures", label: t("fail2ban.col.failures"), value: (row) => row.failures, searchable: false },
  { key: "banCount", label: t("fail2ban.col.banCount"), value: (row) => row.banCount, searchable: false },
  { key: "matches", label: t("fail2ban.col.matches"), value: (row) => row.matches.length, searchable: false },
]);

function show(row: Fail2banHistoryEntry) {
  opened.value = row;
}

function rowKey(row: Fail2banHistoryEntry) {
  return `${row.jail}:${row.ip}:${row.bannedAt}`;
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="flex items-center gap-2 font-medium">
          <UIcon name="i-lucide-history" class="size-4 text-primary" />
          {{ t("fail2ban.historyTitle") }}
        </span>
        <span class="text-xs text-dimmed">{{ t("fail2ban.historyHint") }}</span>
      </div>
    </template>

    <DataTable
      v-model:sort-key="sortKey"
      v-model:sort-direction="sortDirection"
      :data="history"
      :columns="columns"
      :row-key="rowKey"
      :empty-label="t('fail2ban.historyEmpty')"
    >
      <template #bannedAt="{ row }">{{ formatStamp(row.bannedAt, locale) }}</template>
      <template #ip="{ row }">
        <span class="font-mono select-text">{{ row.ip }}</span>
      </template>
      <template #jail="{ row }">
        <UBadge color="neutral" variant="subtle" size="sm">{{ row.jail }}</UBadge>
      </template>
      <template #expiresAt="{ row }">{{ row.expiresAt ? formatStamp(row.expiresAt, locale) : t("fail2ban.forever") }}</template>
      <template #matches="{ row }">
        <UButton
          v-if="row.matches.length"
          size="xs"
          color="neutral"
          variant="subtle"
          icon="i-lucide-file-text"
          :label="String(row.matches.length)"
          @click="show(row)"
        />
        <span v-else class="text-dimmed">-</span>
      </template>
    </DataTable>

    <UModal v-model:open="open" :title="t('fail2ban.matchesTitle', { ip: opened?.ip ?? '', jail: opened?.jail ?? '' })">
      <template #body>
        <div class="overflow-auto rounded-md border border-default bg-muted/40 p-3 font-mono text-xs leading-5 select-text">
          <div v-for="(line, index) in opened?.matches ?? []" :key="index" class="whitespace-pre-wrap break-all">{{ line }}</div>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
