<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "quotas", action: "access" },
    { resource: "quotas", action: "read" },
  ],
});

interface QuotaRow {
  id: number;
  domain: string;
  email?: string;
  bytes: string;
  messages: string;
  lastActivity: string;
}

const page = ref(1);
const limit = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
const search = ref("");
const debouncedSearch = ref("");
const sortDir = ref<"asc" | "desc">("desc");
// `hasLoadedOnce` (NOT `recipientRows.length === 0`) gates both skeletons
// below: a genuinely empty result would otherwise re-show them on every
// page/sort/search reload forever, since length stays 0 on every
// subsequent fetch too. It flips true after the very first settle and
// never reverts (see usePaginatedList.ts for the same pattern).
const hasLoadedOnce = ref(false);

const { t } = useI18n();
const { call } = useApi();
const domainStore = useDomainStore();
const { set: setBreadcrumb } = useBreadcrumb();
const { tick } = useDataRefresh();

const domainCols = computed(() => [
  { accessorKey: "domain", header: t("common.domain") },
  { accessorKey: "bytes", header: t("common.bytes") },
  { accessorKey: "messages", header: t("common.messages") },
  { accessorKey: "lastActivity", header: t("common.lastActivity") },
]);
const recipientCols = computed(() => [
  { accessorKey: "email", header: t("common.address") },
  { accessorKey: "bytes", header: t("common.bytes") },
  { accessorKey: "messages", header: t("common.messages") },
  { accessorKey: "lastActivity", header: t("common.lastActivity") },
]);

// The "per domain" table is a single aggregate row, never paginated -- only
// "per recipient" is (nested `recipients: { items, total }` in the same
// response, see quotas.controller.ts). Not `usePaginatedList` since that
// composable expects the endpoint's top-level shape to be `{items,total}`,
// not nested under `recipients`.
const { data, status, refresh } = useAsyncData<{
  domain: QuotaRow | null;
  recipients: { items: QuotaRow[]; total: number };
}>(
  "quotas-snapshot",
  () => {
    const qs = new URLSearchParams({
      limit: String(limit.value),
      offset: String((page.value - 1) * limit.value),
      sortDir: sortDir.value,
    });
    if (debouncedSearch.value) qs.set("search", debouncedSearch.value);
    return call(`/domains/${domainStore.selected!.id}/quotas?${qs.toString()}`);
  },
  {
    server: false,
    watch: [page, limit, sortDir, debouncedSearch, tick],
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
  const d = domainStore.selected;
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: d?.domain ?? "...", to: d ? `/domains/${d.domain}` : "/domains" },
    { label: t("nav.quotas") },
  ]);
});

async function load() {
  await refresh();
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        :title="t('quotas.alertTitle')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">
      {{ t("quotas.perDomain") }}
    </h2>
    <USkeleton v-if="!hasLoadedOnce" class="h-16 w-full rounded-lg" />
    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
        <UTable :columns="domainCols" :data="domainRows" :loading="loading" sticky />
      </UCard>

      <div class="lg:hidden space-y-3">
        <p v-if="domainRows.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <QuotaCard v-for="item in domainRows" v-else :key="item.id" :item="item" />
      </div>
    </template>

    <ListToolbar v-model:search="search" v-model:limit="limit" v-model:sort-dir="sortDir" />

    <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">
      {{ t("quotas.perRecipient") }}
    </h2>
    <ListSkeleton v-if="!hasLoadedOnce" :columns="3" />
    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
        <UTable :columns="recipientCols" :data="recipientRows" :loading="loading" sticky />
      </UCard>

      <div class="lg:hidden space-y-3">
        <p v-if="recipientRows.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <QuotaCard v-for="item in recipientRows" v-else :key="item.id" :item="item" />
      </div>
    </template>

    <div class="flex justify-center">
      <UPagination v-model:page="page" :total="total" :items-per-page="limit" />
    </div>
  </div>
</template>
