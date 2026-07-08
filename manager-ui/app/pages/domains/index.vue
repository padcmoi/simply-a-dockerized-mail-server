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

interface Domain {
  id: number;
  domain: string;
  quota: string;
  usedBytes: string;
  active: number;
}
interface Disk {
  totalBytes: number;
  freeBytes: number;
  reservedBytes: number;
  assignableBytes: number;
}

const MB = 1024 * 1024;
const MIN_QUOTA_MB = 10;

const disk = ref<Disk | null>(null);
const diskLoading = ref(false);
const form = reactive({ domain: "", active: true, quotaMb: MIN_QUOTA_MB });

const assignableMb = computed(() => (disk.value ? Math.floor(disk.value.assignableBytes / MB) : 0));
const quotaOverLimit = computed(() => form.quotaMb > assignableMb.value);
const quotaUnderLimit = computed(() => form.quotaMb < MIN_QUOTA_MB);
// `GET /domains` now only needs `access` -- the table always renders (the
// backend scopes rows to just what the caller owns without `read`, see
// domains.controller.ts/domains.service.ts). `GET /domains/disk` still
// needs `read` specifically (aggregate stats across every domain), so the
// capacity card keeps its own, stricter gate.
const canSeeAllDomains = computed(() => auth.session?.isRoot === true || perms.hasGlobal("domains", "read"));
const canCreateDomain = computed(() => auth.session?.isRoot === true || perms.hasGlobal("domains", "create"));
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
  if (!adminModalItem.value) return assignableMb.value;
  const bytes = Number(adminModalItem.value.quota);
  const currentMb = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / MB) : 0;
  return assignableMb.value + currentMb;
});
// Same source feeds the desktop column headers below and ListToolbar's
// mobile sort select.
const SORTABLE_COLUMNS = computed(() => [
  { key: "id", label: t("domains.table.id") },
  { key: "domain", label: t("domains.table.domain") },
  { key: "active", label: t("domains.table.active") },
  { key: "quota", label: t("domains.table.quotaMb") },
]);

const columns = computed(() => [
  { accessorKey: "id", header: header("id", t("domains.table.id")) },
  { accessorKey: "domain", header: header("domain", t("domains.table.domain")) },
  { accessorKey: "active", header: header("active", t("domains.table.active")) },
  { accessorKey: "quota", header: header("quota", t("domains.table.quotaMb")) },
  { id: "actions", header: "" },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const domainStore = useDomainStore();
const auth = useAuthStore();
const perms = usePermissionsStore();
const { set: setBreadcrumb } = useBreadcrumb();

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
} = usePaginatedList<Domain>("domains-list", () => "/domains", "id");
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

watch(useDataRefresh().tick, loadDisk);

async function loadDisk() {
  if (!canSeeAllDomains.value) return;
  diskLoading.value = true;
  try {
    disk.value = await call<Disk>("/domains/disk");
  } catch (err) {
    toast.add({
      title: t("domains.toast.loadFailed"),
      description: (err as Error).message,
      color: "error",
    });
  } finally {
    diskLoading.value = false;
  }
}

async function load() {
  await Promise.all([loadDisk(), loadDomains()]);
}

async function create() {
  if (quotaUnderLimit.value) {
    toast.add({ title: t("domains.toast.quotaTooLow", { value: MIN_QUOTA_MB }), color: "error" });
    return;
  }
  if (quotaOverLimit.value) {
    toast.add({ title: t("domains.toast.quotaTooHigh"), color: "error" });
    return;
  }
  try {
    await call("/domains", {
      method: "POST",
      body: {
        domain: form.domain,
        active: form.active,
        quota: form.quotaMb * MB,
      },
    });
    form.domain = "";
    form.quotaMb = MIN_QUOTA_MB;
    await load();
    toast.add({ title: t("domains.toast.added"), color: "success" });
  } catch (err) {
    toast.add({
      title: t("domains.toast.addFailed"),
      description: (err as Error).message,
      color: "error",
    });
  }
}

function openDomain(d: Domain) {
  domainStore.select(d);
  navigateTo(`/domains/${d.domain}`);
}

function occupancyPercent(d: Domain) {
  const quota = Number(d.quota);
  if (!Number.isFinite(quota) || quota <= 0) return 0;
  return Math.min(100, (Number(d.usedBytes) / quota) * 100);
}

function occupancyLabel(d: Domain) {
  return `${formatBytes(Number(d.usedBytes))} / ${formatBytes(Number(d.quota))}`;
}

function occupancyColor(d: Domain) {
  const pct = occupancyPercent(d);
  if (pct > 90) return "error";
  if (pct > 70) return "warning";
  return "success";
}

onMounted(loadDisk);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        :title="t('domains.alertTitle')"
        :description="t('domains.alertDescription')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="ghost"
        :loading="loading || diskLoading"
        square
        @click="load"
      />
    </div>

    <DomainsCapacityCard v-if="canSeeAllDomains" :disk="disk" />

    <UCard v-if="canCreateDomain">
      <template #header>
        <h2 class="font-semibold">{{ t("domains.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-start" @submit="create">
        <UFormField :label="t('domains.form.fqdn')" name="domain">
          <UInput v-model="form.domain" placeholder="example.com" icon="i-lucide-globe" class="w-full" />
        </UFormField>
        <UFormField
          :label="t('domains.form.quotaMb')"
          name="quotaMb"
          :error="
            quotaUnderLimit
              ? t('domains.form.quotaMin', { value: MIN_QUOTA_MB })
              : quotaOverLimit
                ? t('domains.form.quotaMax', { value: assignableMb })
                : undefined
          "
          :hint="t('domains.form.quotaRange', { min: MIN_QUOTA_MB, max: assignableMb })"
        >
          <UInput v-model.number="form.quotaMb" type="number" :min="MIN_QUOTA_MB" :max="assignableMb" class="w-32" />
        </UFormField>
        <UFormField :label="t('domains.form.active')" name="active">
          <USwitch v-model="form.active" />
        </UFormField>
        <UButton
          type="submit"
          icon="i-lucide-plus"
          :disabled="!form.domain || quotaOverLimit || quotaUnderLimit"
          block
          class="sm:w-auto"
        >
          {{ t("domains.form.submit") }}
        </UButton>
      </UForm>
    </UCard>

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
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
        <UTable :columns="columns" :data="items" :loading="loading" sticky>
          <template #domain-cell="{ row }">
            <button class="font-medium text-primary hover:underline text-left" @click="openDomain(row.original)">
              {{ row.original.domain }}
            </button>
          </template>
          <template #active-cell="{ row }">
            <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
              {{ row.original.active ? t("common.yes") : t("common.no") }}
            </UBadge>
          </template>
          <template #quota-cell="{ row }">
            <div class="min-w-[110px]">
              <p>{{ occupancyLabel(row.original) }}</p>
              <UProgress
                :model-value="occupancyPercent(row.original)"
                :color="occupancyColor(row.original)"
                size="xs"
                class="mt-1"
              />
            </div>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-2">
              <UButton
                v-if="canAdminister(row.original.id)"
                icon="i-lucide-shield-alert"
                color="warning"
                variant="outline"
                size="xs"
                @click="openAdminModal(row.original)"
              />

              <UButton icon="i-lucide-arrow-right" color="primary" variant="outline" size="xs" @click="openDomain(row.original)">
                {{ t("common.manage") }}
              </UButton>
            </div>
          </template>
        </UTable>
      </UCard>

      <div class="lg:hidden space-y-3">
        <p v-if="items.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <DomainCard
          v-for="item in items"
          v-else
          :key="item.id"
          :item="item"
          :can-administer="canAdminister(item.id)"
          @open="openDomain(item)"
          @administer="openAdminModal(item)"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <DomainAdminModal
      v-if="adminModalItem"
      v-model:open="adminModalOpen"
      :item="adminModalItem"
      :saving="adminSaving"
      :min-quota-mb="MIN_QUOTA_MB"
      :max-quota-mb="adminMaxQuotaMb"
      :can-delete="canDeleteDomain(adminModalItem.id)"
      @save="saveAdmin"
      @delete="deleteFromAdminModal"
    />
  </div>
</template>
