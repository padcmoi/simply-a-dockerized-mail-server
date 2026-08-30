<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "quotas", action: "access" },
    { resource: "quotas", action: "view-quotas" },
  ],
});

const page = ref(1);
const limit = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
const search = ref("");
const debouncedSearch = ref("");
const sortBy = ref("id");
const sortDir = ref<"asc" | "desc">("desc");
// `hasLoadedOnce` (NOT `recipientRows.length === 0`) gates both skeletons
// below: a genuinely empty result would otherwise re-show them on every
// page/sort/search reload forever, since length stays 0 on every
// subsequent fetch too. It flips true after the very first settle and
// never reverts (see usePaginatedList.ts for the same pattern).
const hasLoadedOnce = ref(false);

const { t } = useI18n();
const { call } = useApi();
const { formatDateTime } = useDateTime();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();
const { tick } = useDataRefresh();
// Declared once for both renderings, which DataTable chooses between on its own
// width.
//
// Quota and usage read exactly as they do on the recipients page (same labels,
// same occupancy bar); what this table adds on top is the message count and the
// last delivery date, which live nowhere else.
const recipientCols = computed<DataTableColumn<QuotaRow>[]>(() => [
  { key: "email", label: t("common.address"), value: (row) => row.email ?? "", primary: true },
  { key: "quota", label: t("recipients.table.quota"), value: (row) => Number(row.quota ?? 0) },
  { key: "bytes", label: t("recipients.table.used"), value: (row) => Number(row.bytes) },
  { key: "messages", label: t("common.messages"), value: (row) => Number(row.messages) },
  { key: "lastActivity", label: t("common.lastActivity"), value: (row) => row.lastActivity },
]);

// `bytes` is what dovecot has written, summed over the domain's mailboxes:
// consumption, not a neutral byte count. Shown against the domain's own quota,
// which is the only figure that says whether it matters.
//
// Same component as the list under it and the same columns declared the same way,
// with the search and the pager taken off: this is one aggregate row, there is
// nothing to look for in it and no second page behind it.
const domainCols = computed<DataTableColumn<QuotaRow>[]>(() => [
  { key: "domain", label: t("common.domain"), value: (row) => row.domain, primary: true },
  { key: "bytes", label: t("quotas.totalUsed"), value: (row) => Number(row.bytes) },
  { key: "messages", label: t("common.messages"), value: (row) => Number(row.messages) },
  { key: "lastActivity", label: t("common.lastActivity"), value: (row) => row.lastActivity },
]);
// The "per domain" table is a single aggregate row, never paginated -- only
// "per recipient" is (nested `recipients: { items, total }` in the same
// response, see quotas.controller.ts). Not `usePaginatedList` since that
// composable expects the endpoint's top-level shape to be `{items,total}`,
// not nested under `recipients`.
const { data, status } = useAsyncData<{
  domain: QuotaRow | null;
  recipients: { items: QuotaRow[]; total: number };
}>(
  "quotas-snapshot",
  async () => {
    // `until` resolves immediately if `domainId` is already set (the normal
    // case: arriving via the domain dashboard, where it's resolved already)
    // and otherwise suspends this fetch -- keeping `status` genuinely
    // "pending" -- until useCurrentDomain's own resolve finishes. This also
    // covers a same-instance domain switch (URL edit/back-forward), where
    // `domainId` briefly drops back to null: `watch` below re-triggers this
    // fetch on that change, and it just waits again for the new value.
    // `immediate: false` was tried here first and was wrong: it skips the
    // very first automatic run unconditionally, so when `domainId` is
    // already resolved at mount (never transitions null -> value) no other
    // watched source changes on its own, and the fetch never runs at all.
    await until(domainId).toBeTruthy();
    const qs = new URLSearchParams({
      limit: String(limit.value),
      offset: String((page.value - 1) * limit.value),
      sortDir: sortDir.value,
      sortBy: sortBy.value,
    });
    if (debouncedSearch.value) qs.set("search", debouncedSearch.value);
    return call(`/domains/${domainId.value}/quotas?${qs.toString()}`);
  },
  {
    server: false,
    watch: [page, limit, sortBy, sortDir, debouncedSearch, tick, domainId],
    default: () => ({ domain: null, recipients: { items: [], total: 0 } }),
  }
);

const domainRows = computed(() => (data.value?.domain ? [data.value.domain] : []));
const recipientRows = computed(() => data.value?.recipients.items ?? []);
const total = computed(() => data.value?.recipients.total ?? 0);
const loading = computed(() => status.value === "pending");

const applyDebouncedSearch = useDebounceFn(() => {
  page.value = 1;
  debouncedSearch.value = search.value;
}, 1000);
watch(search, applyDebouncedSearch);
watch(
  status,
  (s) => {
    if (s === "success" || s === "error") hasLoadedOnce.value = true;
  },
  { immediate: true }
);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value, to: `/admin/domains/${domainFqdn.value}` },
    { label: t("nav.quotas") },
  ]);
});

function occupancy(row: QuotaRow) {
  return occupancyPercent(Number(row.quota ?? 0), Number(row.bytes));
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-info" :title="t('quotas.alertTitle')" />

    <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">
      {{ t("quotas.perDomain") }}
    </h2>
    <USkeleton v-if="!hasLoadedOnce" class="h-16 w-full rounded-lg" />

    <DataTable
      v-else
      :data="domainRows"
      :columns="domainCols"
      :loading="loading"
      :row-key="(row: QuotaRow) => row.id"
      :with-search="false"
      :with-pagination="false"
      :empty-label="t('common.noResults')"
    >
      <!-- `quota`, `bytes` and `messages` arrive as strings: MariaDB BIGINTs,
           which the driver keeps as text rather than lose precision. -->
      <template #bytes="{ row }">
        <div class="min-w-[140px]">
          <p>
            {{ formatBytes(Number(row.bytes)) }}
            <span class="text-dimmed">/ {{ formatBytes(Number(row.quota ?? 0)) }}</span>
          </p>
          <UProgress :model-value="occupancy(row)" :color="occupancyColor(occupancy(row))" size="xs" class="mt-1" />
        </div>
      </template>

      <template #messages="{ row }">
        <span>{{ Number(row.messages).toLocaleString() }}</span>
      </template>

      <template #lastActivity="{ row }">
        <span>{{ formatDateTime(row.lastActivity) }}</span>
      </template>
    </DataTable>

    <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">
      {{ t("quotas.perRecipient") }}
    </h2>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="5" />

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      :data="recipientRows"
      :columns="recipientCols"
      :total="total"
      :loading="loading"
      :row-key="(row: QuotaRow) => row.id"
      :empty-label="t('common.noResults')"
    >
      <template #quota="{ row }">
        <span>{{ formatBytes(Number(row.quota ?? 0)) }}</span>
      </template>

      <template #bytes="{ row }">
        <div class="min-w-[110px]">
          <p>{{ formatBytes(Number(row.bytes)) }}</p>
          <UProgress :model-value="occupancy(row)" :color="occupancyColor(occupancy(row))" size="xs" class="mt-1" />
        </div>
      </template>

      <template #messages="{ row }">
        <span>{{ Number(row.messages).toLocaleString() }}</span>
      </template>

      <template #lastActivity="{ row }">
        <span>{{ formatDateTime(row.lastActivity) }}</span>
      </template>
    </DataTable>
  </div>
</template>
