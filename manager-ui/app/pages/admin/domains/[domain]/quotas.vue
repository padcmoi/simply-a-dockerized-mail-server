<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "quotas", action: "access" },
    { resource: "quotas", action: "view-quotas" },
  ],
});

interface QuotaRow {
  id: number;
  domain: string;
  email?: string;
  // Absent on the domain aggregate row (virtual_quota_domains holds counters
  // only); joined from virtual_users on every recipient row.
  quota?: string;
  bytes: string;
  messages: string;
  lastActivity: string;
}

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
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

// Single source for both the desktop clickable headers and the mobile
// select's column x direction options (ListToolbar's `sortable-columns` prop)
// -- the "per domain" table below has none of this: it's a single aggregate
// row, never paginated/sorted.
// Quota and usage read exactly as they do on the recipients page (same labels,
// same occupancy bar); what this table adds on top is the message count and
// the last delivery date, which live nowhere else.
const RECIPIENT_SORTABLE_COLUMNS = computed(() => [
  { key: "email", label: t("common.address") },
  { key: "quota", label: t("recipients.table.quota") },
  { key: "bytes", label: t("recipients.table.used") },
  { key: "messages", label: t("common.messages") },
  { key: "lastActivity", label: t("common.lastActivity") },
]);

// `bytes` is what dovecot has written, summed over the domain's mailboxes:
// consumption, not a neutral byte count. Shown against the domain's own quota,
// which is the only figure that says whether it matters.
const domainCols = computed(() => [
  { accessorKey: "domain", header: t("common.domain") },
  { accessorKey: "bytes", header: t("quotas.totalUsed") },
  { accessorKey: "messages", header: t("common.messages") },
  { accessorKey: "lastActivity", header: t("common.lastActivity") },
]);
const recipientCols = computed(() =>
  RECIPIENT_SORTABLE_COLUMNS.value.map((c) => ({ accessorKey: c.key, header: header(c.key, c.label) }))
);

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
    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden xl:block">
        <UTable :columns="domainCols" :data="domainRows" :loading="loading" sticky>
          <!-- `quota`, `bytes` and `messages` arrive as strings: MariaDB
               BIGINTs, which the driver keeps as text rather than lose
               precision. -->
          <template #bytes-cell="{ row }">
            <div class="min-w-[140px]">
              <p>
                {{ formatBytes(Number(row.original.bytes)) }}
                <span class="text-dimmed">/ {{ formatBytes(Number(row.original.quota ?? 0)) }}</span>
              </p>
              <UProgress
                :model-value="occupancy(row.original)"
                :color="occupancyColor(occupancy(row.original))"
                size="xs"
                class="mt-1"
              />
            </div>
          </template>
          <template #messages-cell="{ row }">
            <span>{{ Number(row.original.messages).toLocaleString() }}</span>
          </template>
          <template #lastActivity-cell="{ row }">
            <span>{{ formatDateTime(row.original.lastActivity) }}</span>
          </template>
        </UTable>
      </UCard>

      <div class="xl:hidden space-y-3">
        <p v-if="domainRows.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <QuotaCard v-for="item in domainRows" v-else :key="item.id" :item="item" />
      </div>
    </template>

    <ListToolbar
      v-model:search="search"
      v-model:limit="limit"
      v-model:sort-by="sortBy"
      v-model:sort-dir="sortDir"
      :total="total"
      :sortable-columns="RECIPIENT_SORTABLE_COLUMNS"
    />

    <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">
      {{ t("quotas.perRecipient") }}
    </h2>
    <ListSkeleton v-if="!hasLoadedOnce" :columns="3" />
    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden xl:block">
        <UTable :columns="recipientCols" :data="recipientRows" :loading="loading" sticky>
          <template #quota-cell="{ row }">
            <span>{{ formatBytes(Number(row.original.quota ?? 0)) }}</span>
          </template>
          <template #bytes-cell="{ row }">
            <div class="min-w-[110px]">
              <p>{{ formatBytes(Number(row.original.bytes)) }}</p>
              <UProgress
                :model-value="occupancy(row.original)"
                :color="occupancyColor(occupancy(row.original))"
                size="xs"
                class="mt-1"
              />
            </div>
          </template>
          <template #messages-cell="{ row }">
            <span>{{ Number(row.original.messages).toLocaleString() }}</span>
          </template>
          <template #lastActivity-cell="{ row }">
            <span>{{ formatDateTime(row.original.lastActivity) }}</span>
          </template>
        </UTable>
      </UCard>

      <div class="xl:hidden space-y-3">
        <p v-if="recipientRows.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <QuotaCard v-for="item in recipientRows" v-else :key="item.id" :item="item" />
      </div>
    </template>

    <ListPagination v-model:page="page" :total="total" :limit="limit" />
  </div>
</template>
