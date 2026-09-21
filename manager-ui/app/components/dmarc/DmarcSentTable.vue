<script setup lang="ts">
const emit = defineEmits<{ changed: [] }>();
const page = defineModel<number>("page", { default: 1 });
const limit = defineModel<number>("pageSize", { default: 10 });
const search = defineModel<string>("search", { default: "" });
const searchBy = defineModel<string>("searchBy", { default: ALL_COLUMNS });
const sortKey = defineModel<string>("sortKey", { default: "" });
const sortDirection = defineModel<"asc" | "desc">("sortDirection", { default: "desc" });
const status = defineModel<string>("status", { default: "" });
const domain = defineModel<string>("domain", { default: "" });

defineProps<{ rows: DmarcOutgoingReport[]; total: number; loading: boolean; domains: string[] }>();

const { t, te } = useI18n();
const { formatDateTime } = useDateTime();
const { period, count } = useDmarcFormat();
const { canSend } = useDmarcAccess();
const { busy, retry, download } = useDmarcActions();

const COLORS: Record<DmarcOutgoingStatus, "success" | "error" | "warning"> = {
  sent: "success",
  failed: "error",
  skipped: "warning",
};

const ALL = "__all__";
const statusItems = computed(() => [
  { label: t("dmarc.sent.allStatuses"), value: ALL },
  ...(["sent", "failed", "skipped"] as const).map((value) => ({ label: t(`dmarc.outgoingStatus.${value}`), value })),
]);
const statusFilter = computed({
  get: () => status.value || ALL,
  set: (value: string) => {
    status.value = value === ALL ? "" : value;
  },
});

const columns = computed<DataTableColumn<DmarcOutgoingReport>[]>(() => [
  { key: "createdAt", label: t("dmarc.sent.col.created"), value: (row) => row.createdAt, searchable: false },
  { key: "reporterDomain", label: t("dmarc.sent.col.reporter"), value: (row) => row.reporterDomain },
  { key: "policyDomain", label: t("dmarc.sent.col.domain"), value: (row) => row.policyDomain, primary: true },
  { key: "recipient", label: t("dmarc.sent.col.recipient"), value: (row) => row.recipient },
  { key: "period", label: t("dmarc.sent.col.period"), value: (row) => row.periodBegin, sortable: false, searchable: false },
  { key: "messages", label: t("dmarc.sent.col.messages"), value: (row) => row.messages, searchable: false },
  { key: "status", label: t("dmarc.sent.col.status"), value: (row) => row.status, searchable: false },
  { key: "attempts", label: t("dmarc.sent.col.attempts"), value: (row) => row.attempts, sortable: false, searchable: false },
]);

function reasonOf(row: DmarcOutgoingReport) {
  if (!row.reason) return "";
  const key = `dmarc.reason.${row.reason}`;
  return te(key) ? t(key) : row.reason;
}

function retryable(row: DmarcOutgoingReport) {
  return canSend.value && row.status !== "sent" && row.reason !== "too-large";
}

async function onRetry(row: DmarcOutgoingReport) {
  if (await retry(row.id)) emit("changed");
}
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
    :row-key="(row: DmarcOutgoingReport) => row.id"
    :empty-label="t('dmarc.sent.empty')"
  >
    <template #filters>
      <DmarcDomainFilter v-model="domain" :domains="domains" />
      <USelect v-model="statusFilter" :items="statusItems" icon="i-lucide-list-filter" class="w-full @lg:w-56" />
    </template>

    <template #createdAt="{ row }">
      <span class="text-muted whitespace-nowrap">{{ formatDateTime(row.createdAt) }}</span>
    </template>

    <template #period="{ row }">
      <span class="whitespace-nowrap">{{ period(row.periodBegin, row.periodEnd) }}</span>
    </template>

    <template #messages="{ row }">{{ count(row.messages) }}</template>

    <template #status="{ row }">
      <FullTooltip v-if="row.reason" :text="reasonOf(row)">
        <UBadge :color="COLORS[row.status]" variant="subtle" size="sm">{{ t(`dmarc.outgoingStatus.${row.status}`) }}</UBadge>
      </FullTooltip>
      <UBadge v-else :color="COLORS[row.status]" variant="subtle" size="sm">{{ t(`dmarc.outgoingStatus.${row.status}`) }}</UBadge>
    </template>

    <template #actions="{ row }">
      <div class="flex items-center justify-end gap-1">
        <UButton
          v-if="retryable(row)"
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="t('dmarc.sent.retry')"
          :loading="busy === row.id"
          :disabled="busy !== null"
          @click="onRetry(row)"
        />
        <UButton
          icon="i-lucide-download"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="t('dmarc.sent.download')"
          @click="download('outgoing', row.id)"
        />
      </div>
    </template>
  </DataTable>
</template>
