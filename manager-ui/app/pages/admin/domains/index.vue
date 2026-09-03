<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

// `access` alone is enough to reach this page and see the table -- the
// backend scopes rows to owned-only without `read` (see domains.service.ts).
// `read` (capacity card) and `create` (add-domain form) each gate their own
// section inside the page, see canSeeAllDomains/canCreateDomain below.
definePageMeta({
  requiredGlobal: [{ resource: "domains", action: "access" }],
});

const MIN_QUOTA_MB = 10;

// `GET /domains` now only needs `access` -- the table always renders (the
// backend scopes rows to just what the caller owns without `read`, see
// domains.controller.ts/domains.service.ts). `GET /domains/disk` still
// needs `read` specifically (aggregate stats across every domain), so the
// capacity card keeps its own, stricter gate.
const canSeeAllDomains = computed(() => auth.session?.isRoot === true || perms.hasGlobal("domains", "list-all-domains"));
const canCreateDomain = computed(() => auth.session?.isRoot === true || perms.hasGlobal("domains", "create-domain"));
const {
  adminModalOpen,
  adminModalItem,
  adminSaving,
  canAdminister,
  canDeleteDomain,
  openAdminModal,
  saveAdmin,
  deleteFromAdminModal,
} = useDomainAdmin(load);
// Freeing up the domain's own current allocation first, then reassigning,
// is valid -- the real ceiling for editing IT is the free pool plus
// whatever it already holds, not just the free pool alone.
const adminMaxQuotaMb = computed(() => {
  const assignable = assignableMb.value ?? 0;
  if (!adminModalItem.value) return assignable;
  const bytes = Number(adminModalItem.value.quota);
  const currentMb = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / MB) : 0;
  return assignable + currentMb;
});
// Declared once: DataTable decides on its own width whether this is a table or
// a block per row, so the page no longer carries one of each.
const columns = computed<DataTableColumn<DomainRow>[]>(() => [
  { key: "id", label: t("domains.table.id"), value: (row) => row.id, hideOnCard: true },
  { key: "domain", label: t("domains.table.domain"), value: (row) => row.domain, primary: true },
  { key: "active", label: t("domains.table.active"), value: (row) => row.active === 1 },
  { key: "quota", label: t("domains.table.quotaMb"), value: (row) => Number(row.quota) },
]);

const { t } = useI18n();
const domainStore = useDomainStore();
const auth = useAuthStore();
const perms = usePermissionsStore();
const { set: setBreadcrumb } = useBreadcrumb();
const { disk, assignableMb, loadDisk } = useDomainDisk();

setBreadcrumb([{ label: t("nav.domains") }]);

const {
  items,
  total,
  loading,
  hasLoadedOnce,
  page,
  limit,
  search,
  sortBy,
  sortDir,
  load: loadDomains,
} = usePaginatedList<DomainRow>("domains-list", () => "/domains", "id");

watch(useDataRefresh().tick, refreshDisk);

// `/domains/disk` aggregates every domain and demands `domains:view-disk-usage`; asking
// for it without that grant would only raise a 403 toast about a card the
// account cannot see anyway.
async function refreshDisk() {
  if (!canSeeAllDomains.value) return;
  await loadDisk();
}

async function load() {
  await Promise.all([refreshDisk(), loadDomains()]);
}

function openDomain(d: DomainRow) {
  domainStore.select(d);
  navigateTo(`/admin/domains/${d.domain}`);
}

function occupancy(d: DomainRow) {
  return occupancyPercent(Number(d.quota), Number(d.usedBytes));
}

function occupancyLabel(d: DomainRow) {
  return `${formatBytes(Number(d.usedBytes))} / ${formatBytes(Number(d.quota))}`;
}

onMounted(refreshDisk);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('domains.alertTitle')"
      :description="t('domains.alertDescription')"
    />

    <DomainsCapacityCard v-if="canSeeAllDomains" :disk="disk" />

    <!-- Same clickable card as the domain dashboard's section links, in the
         slot the create form used to occupy. -->
    <div v-if="canCreateDomain" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <UCard :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }" @click="navigateTo('/admin/domains/create')">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-globe" class="text-info text-xl" />
          <span class="font-medium">{{ t("domains.form.title") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="4" />

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
      :row-key="(row: DomainRow) => row.id"
      :empty-label="t('common.noResults')"
    >
      <template #domain="{ row }">
        <FullTooltip :text="row.domain">
          <button class="text-left font-medium text-primary hover:underline" @click="openDomain(row)">
            {{ truncateChars(row.domain, 44) }}
          </button>
        </FullTooltip>
      </template>

      <template #active="{ row }">
        <UBadge :color="row.active ? 'success' : 'neutral'" variant="subtle">
          {{ row.active ? t("common.yes") : t("common.no") }}
        </UBadge>
      </template>

      <template #quota="{ row }">
        <div class="min-w-[110px]">
          <p>{{ occupancyLabel(row) }}</p>
          <UProgress :model-value="occupancy(row)" :color="occupancyColor(occupancy(row))" size="xs" class="mt-1" />
        </div>
      </template>

      <template #actions="{ row }">
        <UButton
          v-if="canAdminister()"
          icon="i-lucide-shield-alert"
          color="warning"
          variant="outline"
          size="xs"
          @click="openAdminModal(row)"
        />
        <UButton icon="i-lucide-arrow-right" color="primary" variant="outline" size="xs" @click="openDomain(row)">
          {{ t("common.manage") }}
        </UButton>
      </template>
    </DataTable>

    <DomainAdminModal
      v-if="adminModalItem"
      v-model:open="adminModalOpen"
      :item="adminModalItem"
      :saving="adminSaving"
      :min-quota-mb="MIN_QUOTA_MB"
      :max-quota-mb="adminMaxQuotaMb"
      :can-delete="canDeleteDomain()"
      @save="saveAdmin"
      @delete="deleteFromAdminModal"
    />
  </div>
</template>
