<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "aliases", action: "access" },
    { resource: "aliases", action: "list-aliases" },
  ],
});

interface Alias {
  id: number;
  source: string;
  destination: string;
  domain: string;
  // `virtual_aliases.last_activity` carries `ON UPDATE current_timestamp()`:
  // it stamps the row's last edit, not mail traffic. Postfix-legacy name.
  lastActivity: string | null;
}

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);

// Same source feeds the desktop column headers below and ListToolbar's
// mobile sort select.
const SORTABLE_COLUMNS = computed(() => [
  { key: "source", label: t("aliases.table.from") },
  { key: "destination", label: t("aliases.table.to") },
  { key: "lastActivity", label: t("common.lastModification") },
]);

const columns = computed(() => [
  { accessorKey: "source", header: header("source", t("aliases.table.from")) },
  { accessorKey: "destination", header: header("destination", t("aliases.table.to")) },
  { accessorKey: "lastActivity", header: header("lastActivity", t("common.lastModification")) },
  { id: "actions", header: "" },
]);

// The create and edit pages demand aliases:create-alias / aliases:edit-alias. Hiding
// their entry points from an account that lacks the grant beats letting the
// click land on a 403.
const canCreateAliases = computed(() => {
  if (!domainId.value) return false;
  return isRoot.value || (hasDomain(domainId.value, "aliases", "access") && hasDomain(domainId.value, "aliases", "create-alias"));
});
const canEditAliases = computed(() => {
  if (!domainId.value) return false;
  return isRoot.value || (hasDomain(domainId.value, "aliases", "access") && hasDomain(domainId.value, "aliases", "edit-alias"));
});

const { t } = useI18n();
const { call } = useApi();
const { formatDateTime } = useDateTime();
const { isRoot, hasDomain } = usePermissions();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value, to: `/admin/domains/${domainFqdn.value}` },
    { label: t("nav.aliases") },
  ]);
});

const { items, total, loading, hasLoadedOnce, page, limit, search, sortBy, sortDir, load } = usePaginatedList<Alias>(
  "aliases-list",
  () => (domainId.value ? `/domains/${domainId.value}/aliases` : null),
  "id",
  [domainId]
);
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

async function remove(row: Alias) {
  if (!domainId.value) return;
  await call(`/domains/${domainId.value}/aliases/${row.id}`, {
    method: "DELETE",
  });
  await load();
}

function requestDelete(fn: () => Promise<void>) {
  pendingDeleteFn.value = fn;
  confirmOpen.value = true;
}

async function onDeleteConfirmed() {
  await pendingDeleteFn.value?.();
  pendingDeleteFn.value = null;
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-info" :title="t('aliases.alertTitle')" />

    <!-- Same clickable card as the domain dashboard's section links, in the
         slot the create form used to occupy. -->
    <div v-if="canCreateAliases" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <UCard
        :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
        @click="navigateTo(`/admin/domains/${domainFqdn}/aliases/create`)"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-at-sign" class="text-success text-xl" />
          <span class="font-medium">{{ t("aliases.form.title") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>
    </div>

    <ListToolbar
      v-model:search="search"
      v-model:limit="limit"
      v-model:sort-by="sortBy"
      v-model:sort-dir="sortDir"
      :total="total"
      :sortable-columns="SORTABLE_COLUMNS"
    />

    <ListSkeleton v-if="!hasLoadedOnce" :columns="2" />

    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden xl:block">
        <UTable :columns="columns" :data="items" :loading="loading" sticky>
          <template #source-cell="{ row }">
            <UTooltip :text="row.original.source" :ui="{ content: 'max-w-md break-all' }">
              <NuxtLink
                v-if="canEditAliases"
                :to="`/admin/domains/${domainFqdn}/aliases/edit/${row.original.id}`"
                class="font-medium text-primary hover:underline"
              >
                {{ truncateChars(row.original.source, 44) }}
              </NuxtLink>
              <span v-else class="font-medium">{{ truncateChars(row.original.source, 44) }}</span>
            </UTooltip>
          </template>
          <template #destination-cell="{ row }">
            <UTooltip :text="row.original.destination" :ui="{ content: 'max-w-md break-all' }">
              <span>{{ truncateChars(row.original.destination, 44) }}</span>
            </UTooltip>
          </template>
          <template #lastActivity-cell="{ row }">
            <span class="text-muted">{{ formatDateTime(row.original.lastActivity) }}</span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-2">
              <UButton
                v-if="canEditAliases"
                icon="i-lucide-pencil"
                color="primary"
                variant="ghost"
                size="xs"
                square
                @click="navigateTo(`/admin/domains/${domainFqdn}/aliases/edit/${row.original.id}`)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                square
                @click="requestDelete(() => remove(row.original))"
              />
            </div>
          </template>
        </UTable>
      </UCard>

      <div class="xl:hidden space-y-3">
        <p v-if="items.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <AliasCard
          v-for="item in items"
          v-else
          :key="item.id"
          :item="item"
          :can-edit="canEditAliases"
          @delete="requestDelete(() => remove(item))"
          @edit="navigateTo(`/admin/domains/${domainFqdn}/aliases/edit/${item.id}`)"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />
  </div>
</template>
