<script setup lang="ts">
const page = defineModel<number>("page", { default: 1 });
const limit = defineModel<number>("pageSize", { default: 10 });
const search = defineModel<string>("search", { default: "" });
const searchBy = defineModel<string>("searchBy", { default: ALL_COLUMNS });
const sortKey = defineModel<string>("sortKey", { default: "" });
const sortDirection = defineModel<"asc" | "desc">("sortDirection", { default: "desc" });
const status = defineModel<string>("status", { default: "" });
const domain = defineModel<string>("domain", { default: "" });

defineProps<{ rows: DmarcInboxMessage[]; total: number; loading: boolean; domains: string[] }>();

const { t } = useI18n();
const { formatDateTime } = useDateTime();

const STATUSES = ["imported", "duplicate", "not-a-report", "failed"] as const;
const COLORS: Record<DmarcInboxStatus, "success" | "neutral" | "error" | "info"> = {
  imported: "success",
  duplicate: "info",
  "not-a-report": "neutral",
  failed: "error",
};

const ALL = "__all__";
const statusItems = computed(() => [
  { label: t("dmarc.inbox.allStatuses"), value: ALL },
  ...STATUSES.map((value) => ({ label: t(`dmarc.inboxStatus.${value}`), value })),
]);
const statusFilter = computed({
  get: () => status.value || ALL,
  set: (value: string) => {
    status.value = value === ALL ? "" : value;
  },
});

const columns = computed<DataTableColumn<DmarcInboxMessage>[]>(() => [
  { key: "scannedAt", label: t("dmarc.inbox.col.scanned"), value: (row) => row.scannedAt, searchable: false },
  { key: "mailbox", label: t("dmarc.inbox.col.mailbox"), value: (row) => row.mailbox },
  { key: "sender", label: t("dmarc.inbox.col.sender"), value: (row) => row.sender ?? "", sortable: false },
  { key: "subject", label: t("dmarc.inbox.col.subject"), value: (row) => row.subject ?? "", sortable: false, primary: true },
  { key: "status", label: t("dmarc.inbox.col.status"), value: (row) => row.status, searchable: false },
  { key: "reports", label: t("dmarc.inbox.col.reports"), value: (row) => row.reports, sortable: false, searchable: false },
]);
</script>

<template>
  <DataTable
    v-model:page="page"
    v-model:page-size="limit"
    v-model:search="search"
    v-model:search-by="searchBy"
    v-model:sort-key="sortKey"
    v-model:sort-direction="sortDirection"
    :data="rows"
    :columns="columns"
    :total="total"
    :loading="loading"
    :row-key="(row: DmarcInboxMessage) => row.id"
    :empty-label="t('dmarc.inbox.empty')"
  >
    <template #filters>
      <DmarcDomainFilter v-model="domain" :domains="domains" />
      <USelect v-model="statusFilter" :items="statusItems" icon="i-lucide-list-filter" class="w-full @lg:w-56" />
    </template>

    <template #scannedAt="{ row }">
      <span class="text-muted whitespace-nowrap">{{ formatDateTime(row.scannedAt) }}</span>
    </template>

    <template #sender="{ row }">
      <span v-if="row.sender">{{ truncateChars(row.sender, 36) }}</span>
      <span v-else class="text-dimmed">-</span>
    </template>

    <template #subject="{ row }">
      <FullTooltip v-if="row.subject" :text="row.subject">
        <span>{{ truncateChars(row.subject, 56) }}</span>
      </FullTooltip>
      <span v-else class="text-dimmed">-</span>
    </template>

    <template #status="{ row }">
      <FullTooltip v-if="row.detail" :text="row.detail">
        <UBadge :color="COLORS[row.status]" variant="subtle" size="sm">{{ t(`dmarc.inboxStatus.${row.status}`) }}</UBadge>
      </FullTooltip>
      <UBadge v-else :color="COLORS[row.status]" variant="subtle" size="sm">{{ t(`dmarc.inboxStatus.${row.status}`) }}</UBadge>
    </template>
  </DataTable>
</template>
