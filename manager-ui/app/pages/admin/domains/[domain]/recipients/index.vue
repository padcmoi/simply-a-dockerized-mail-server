<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "list-recipients" },
  ],
});

interface Recipient {
  id: number;
  email: string;
  quota: string;
  usedBytes: string;
  active: number;
  // `virtual_users.last_activity` carries `ON UPDATE current_timestamp()`: it
  // stamps the row's last edit, not mail traffic. Postfix-legacy name, kept.
  lastActivity: string | null;
}

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);

// Same source feeds the desktop column headers below and ListToolbar's
// mobile sort select.
const SORTABLE_COLUMNS = computed(() => [
  { key: "email", label: t("recipients.table.address") },
  { key: "quota", label: t("recipients.table.quota") },
  { key: "usedBytes", label: t("recipients.table.used") },
  { key: "active", label: t("recipients.table.active") },
  { key: "lastActivity", label: t("common.lastModification") },
]);

const columns = computed(() => [
  { accessorKey: "email", header: header("email", t("recipients.table.address")) },
  { accessorKey: "quota", header: header("quota", t("recipients.table.quota")) },
  { accessorKey: "usedBytes", header: header("usedBytes", t("recipients.table.used")) },
  { accessorKey: "active", header: header("active", t("recipients.table.active")) },
  { accessorKey: "lastActivity", header: header("lastActivity", t("common.lastModification")) },
  { id: "actions", header: "" },
]);

// The create form now lives on its own page, which demands recipients:create-recipient.
// Hiding the entry point from an account that lacks it beats letting the click
// land on a 403.
const canCreateRecipients = computed(() => {
  if (!domainId.value) return false;
  return (
    isRoot.value ||
    (hasDomain(domainId.value, "recipients", "access") && hasDomain(domainId.value, "recipients", "create-recipient"))
  );
});

// Editing lives on its own page now; the list only decides whether to offer
// the link. Same gate the edit page's route meta enforces.
const canEditRecipients = computed(() => {
  if (!domainId.value) return false;
  return (
    isRoot.value ||
    (hasDomain(domainId.value, "recipients", "access") && hasDomain(domainId.value, "recipients", "edit-recipient"))
  );
});

const { t } = useI18n();
const { call } = useApi();
const { formatDateTime } = useDateTime();
const { isRoot, hasDomain } = usePermissions();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();

// Below the composables it reads, unlike the computed above it: watchEffect
// runs its callback straight away, so `setBreadcrumb` must already be bound.
watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value, to: `/admin/domains/${domainFqdn.value}` },
    { label: t("nav.recipients") },
  ]);
});

const { items, total, loading, hasLoadedOnce, page, limit, search, sortBy, sortDir, load } = usePaginatedList<Recipient>(
  "recipients-list",
  () => (domainId.value ? `/domains/${domainId.value}/recipients` : null),
  "id",
  [domainId]
);
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

function isPostmaster(item: Recipient) {
  return item.email.toLowerCase().startsWith("postmaster@");
}

function editTo(item: Recipient) {
  return `/domains/${domainFqdn.value}/recipients/${item.id}/edit`;
}

function occupancy(r: Recipient) {
  return occupancyPercent(Number(r.quota), Number(r.usedBytes));
}

async function remove(row: Recipient) {
  if (!domainId.value) return;
  await call(`/domains/${domainId.value}/recipients/${row.id}`, {
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
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('recipients.alertTitle')"
      :description="t('recipients.alertDescription')"
    />

    <!-- Same clickable card as the domain dashboard's section links, in the
         slot the create form used to occupy. -->
    <div v-if="canCreateRecipients" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <UCard
        :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
        @click="navigateTo(`/admin/domains/${domainFqdn}/recipients/create`)"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-user-plus" class="text-info text-xl" />
          <span class="font-medium">{{ t("recipients.form.title") }}</span>
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

    <ListSkeleton v-if="!hasLoadedOnce" :columns="4" />

    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden xl:block">
        <UTable :columns="columns" :data="items" :loading="loading" sticky>
          <template #email-cell="{ row }">
            <div class="flex items-center gap-2">
              <UTooltip :text="row.original.email" :ui="{ content: 'max-w-md break-all' }">
                <NuxtLink
                  v-if="canEditRecipients && !isPostmaster(row.original)"
                  :to="editTo(row.original)"
                  class="font-medium text-primary hover:underline"
                >
                  {{ truncateChars(row.original.email, 44) }}
                </NuxtLink>
                <span v-else class="font-medium">{{ truncateChars(row.original.email, 44) }}</span>
              </UTooltip>
              <UBadge v-if="isPostmaster(row.original)" color="neutral" variant="subtle" size="xs" icon="i-lucide-lock">
                {{ t("recipients.postmaster.badge") }}
              </UBadge>
            </div>
          </template>
          <template #quota-cell="{ row }">
            <span>{{ formatBytes(Number(row.original.quota)) }}</span>
          </template>
          <template #usedBytes-cell="{ row }">
            <div class="min-w-[110px]">
              <p>{{ formatBytes(Number(row.original.usedBytes)) }}</p>
              <UProgress
                :model-value="occupancy(row.original)"
                :color="occupancyColor(occupancy(row.original))"
                size="xs"
                class="mt-1"
              />
            </div>
          </template>
          <template #active-cell="{ row }">
            <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
              {{ row.original.active ? t("common.yes") : t("common.no") }}
            </UBadge>
          </template>
          <template #lastActivity-cell="{ row }">
            <span class="text-muted">{{ formatDateTime(row.original.lastActivity) }}</span>
          </template>
          <template #actions-cell="{ row }">
            <div v-if="!isPostmaster(row.original)" class="flex justify-end gap-2">
              <UButton
                v-if="canEditRecipients"
                :to="editTo(row.original)"
                icon="i-lucide-pencil"
                color="primary"
                variant="ghost"
                size="xs"
                square
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
            <UTooltip v-else :text="t('recipients.postmaster.locked')">
              <UIcon name="i-lucide-lock" class="text-dimmed" />
            </UTooltip>
          </template>
        </UTable>
      </UCard>

      <div class="xl:hidden space-y-3">
        <p v-if="items.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <RecipientCard
          v-for="item in items"
          v-else
          :key="item.id"
          :item="item"
          :is-postmaster="isPostmaster(item)"
          :can-edit="canEditRecipients"
          :edit-to="editTo(item)"
          @delete="requestDelete(() => remove(item))"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <ConfirmModal v-model:open="confirmOpen" :description="t('recipients.confirmDeleteDesc')" @confirm="onDeleteConfirmed" />
  </div>
</template>
