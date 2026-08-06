<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
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

// Declared once for both renderings, which DataTable chooses between on its own
// width rather than this page carrying one of each.
const columns = computed<DataTableColumn<Recipient>[]>(() => [
  { key: "email", label: t("recipients.table.address"), value: (row) => row.email, primary: true },
  { key: "quota", label: t("recipients.table.quota"), value: (row) => Number(row.quota) },
  { key: "usedBytes", label: t("recipients.table.used"), value: (row) => Number(row.usedBytes) },
  { key: "active", label: t("recipients.table.active"), value: (row) => row.active === 1 },
  { key: "lastActivity", label: t("common.lastModification"), value: (row) => row.lastActivity },
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

function isPostmaster(item: Recipient) {
  return item.email.toLowerCase().startsWith("postmaster@");
}

function editTo(item: Recipient) {
  return `/admin/domains/${domainFqdn.value}/recipients/${item.id}/edit`;
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

    <ListSkeleton v-if="!hasLoadedOnce" :columns="5" />

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
      :row-key="(row: Recipient) => row.id"
      :empty-label="t('common.noResults')"
    >
      <template #email="{ row }">
        <div class="flex items-center gap-2 min-w-0">
          <FullTooltip :text="row.email">
            <NuxtLink
              v-if="canEditRecipients && !isPostmaster(row)"
              :to="editTo(row)"
              class="font-medium text-primary hover:underline"
            >
              {{ truncateChars(row.email, 44) }}
            </NuxtLink>
            <span v-else class="font-medium">{{ truncateChars(row.email, 44) }}</span>
          </FullTooltip>
          <UBadge v-if="isPostmaster(row)" color="neutral" variant="subtle" size="xs" icon="i-lucide-lock">
            {{ t("recipients.postmaster.badge") }}
          </UBadge>
        </div>
      </template>

      <template #quota="{ row }">
        <span>{{ formatBytes(Number(row.quota)) }}</span>
      </template>

      <template #usedBytes="{ row }">
        <div class="min-w-[110px]">
          <p>{{ formatBytes(Number(row.usedBytes)) }}</p>
          <UProgress :model-value="occupancy(row)" :color="occupancyColor(occupancy(row))" size="xs" class="mt-1" />
        </div>
      </template>

      <template #active="{ row }">
        <UBadge :color="row.active ? 'success' : 'neutral'" variant="subtle">
          {{ row.active ? t("common.yes") : t("common.no") }}
        </UBadge>
      </template>

      <template #lastActivity="{ row }">
        <span class="text-muted">{{ formatDateTime(row.lastActivity) }}</span>
      </template>

      <template #actions="{ row }">
        <template v-if="!isPostmaster(row)">
          <UButton
            v-if="canEditRecipients"
            :to="editTo(row)"
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
            @click="requestDelete(() => remove(row))"
          />
        </template>
        <FullTooltip v-else :text="t('recipients.postmaster.locked')">
          <UIcon name="i-lucide-lock" class="text-dimmed" />
        </FullTooltip>
      </template>
    </DataTable>

    <ConfirmModal v-model:open="confirmOpen" :description="t('recipients.confirmDeleteDesc')" @confirm="onDeleteConfirmed" />
  </div>
</template>
