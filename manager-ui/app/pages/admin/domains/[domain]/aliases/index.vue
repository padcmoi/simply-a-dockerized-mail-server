<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
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

// Declared once for both renderings, which DataTable chooses between on its own
// width rather than this page carrying one of each.
const columns = computed<DataTableColumn<Alias>[]>(() => [
  { key: "source", label: t("aliases.table.from"), value: (row) => row.source, primary: true },
  { key: "destination", label: t("aliases.table.to"), value: (row) => row.destination },
  { key: "lastActivity", label: t("common.lastModification"), value: (row) => row.lastActivity },
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

function editAlias(alias: Alias) {
  navigateTo(`/admin/domains/${domainFqdn.value}/aliases/edit/${alias.id}`);
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

    <ListSkeleton v-if="!hasLoadedOnce" :columns="3" />

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      :data="items"
      :columns="columns"
      :total="total"
      :loading="loading"
      :row-key="(row: Alias) => row.id"
      :empty-label="t('common.noResults')"
    >
      <template #source="{ row }">
        <FullTooltip :text="row.source">
          <NuxtLink
            v-if="canEditAliases"
            :to="`/admin/domains/${domainFqdn}/aliases/edit/${row.id}`"
            class="font-medium text-primary hover:underline"
          >
            {{ truncateChars(row.source, 44) }}
          </NuxtLink>
          <span v-else class="font-medium">{{ truncateChars(row.source, 44) }}</span>
        </FullTooltip>
      </template>

      <template #destination="{ row }">
        <FullTooltip :text="row.destination">
          <span>{{ truncateChars(row.destination, 44) }}</span>
        </FullTooltip>
      </template>

      <template #lastActivity="{ row }">
        <span class="text-muted">{{ formatDateTime(row.lastActivity) }}</span>
      </template>

      <template #actions="{ row }">
        <UButton
          v-if="canEditAliases"
          icon="i-lucide-pencil"
          color="primary"
          variant="ghost"
          size="xs"
          square
          @click="editAlias(row)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          square
          @click="requestDelete(() => remove(row))"
        />
      </template>
    </DataTable>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />
  </div>
</template>
