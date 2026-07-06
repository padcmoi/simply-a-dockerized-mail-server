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

const domainRows = ref<QuotaRow[]>([]);
const recipientRows = ref<QuotaRow[]>([]);
const loading = ref(false);
const page = ref(1);
const limit = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
const search = ref("");
const sortDir = ref<"asc" | "desc">("desc");
const total = ref(0);

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

const { t } = useI18n();
const { call } = useApi();
const domainStore = useDomainStore();
const { set: setBreadcrumb } = useBreadcrumb();

watch(
  search,
  useDebounceFn(() => {
    page.value = 1;
    load();
  }, 1000)
);
watch([page, limit, sortDir], load);
watch(useDataRefresh().tick, load);

watchEffect(() => {
  const d = domainStore.selected;
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: d?.domain ?? "...", to: d ? `/domains/${d.domain}` : "/domains" },
    { label: t("nav.quotas") },
  ]);
});

// The "per domain" table is a single aggregate row, never paginated -- only
// "per recipient" is (nested `recipients: { items, total }` in the same
// response, see quotas.controller.ts). Not `usePaginatedList` since that
// composable expects the endpoint's top-level shape to be `{items,total}`,
// not nested under `recipients`.
async function load() {
  loading.value = true;
  try {
    const qs = new URLSearchParams({
      limit: String(limit.value),
      offset: String((page.value - 1) * limit.value),
      sortDir: sortDir.value,
    });
    if (search.value) qs.set("search", search.value);
    const data = await call<{ domain: QuotaRow | null; recipients: { items: QuotaRow[]; total: number } }>(
      `/domains/${domainStore.selected!.id}/quotas?${qs.toString()}`
    );
    domainRows.value = data.domain ? [data.domain] : [];
    recipientRows.value = data.recipients.items;
    total.value = data.recipients.total;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
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

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
      <template #header>
        <h2 class="font-semibold">{{ t("quotas.perDomain") }}</h2>
      </template>
      <UTable :columns="domainCols" :data="domainRows" :loading="loading" sticky />
    </UCard>

    <div class="lg:hidden space-y-3">
      <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">
        {{ t("quotas.perDomain") }}
      </h2>
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="domainRows.length === 0" class="text-sm text-muted text-center py-6">-</p>
      <QuotaCard v-for="item in domainRows" v-else :key="item.id" :item="item" />
    </div>

    <ListToolbar v-model:search="search" v-model:limit="limit" v-model:sort-dir="sortDir" />

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
      <template #header>
        <h2 class="font-semibold">{{ t("quotas.perRecipient") }}</h2>
      </template>
      <UTable :columns="recipientCols" :data="recipientRows" :loading="loading" sticky />
    </UCard>

    <div class="lg:hidden space-y-3">
      <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">
        {{ t("quotas.perRecipient") }}
      </h2>
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="recipientRows.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
      <QuotaCard v-for="item in recipientRows" v-else :key="item.id" :item="item" />
    </div>

    <div class="flex justify-center">
      <UPagination v-model:page="page" :total="total" :items-per-page="limit" />
    </div>
  </div>
</template>
