<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "read" },
  ],
});

interface Recipient {
  id: number;
  email: string;
  quota: string;
  usedBytes: string;
  active: number;
}

const MB = 1024 * 1024;
const MIN_QUOTA_MB = 1;

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);
const form = reactive({ localPart: "", password: "", quotaMb: 500 });

const quotaUnderLimit = computed(() => form.quotaMb < MIN_QUOTA_MB);

// Same source feeds the desktop column headers below and ListToolbar's
// mobile sort select.
const SORTABLE_COLUMNS = computed(() => [
  { key: "email", label: t("recipients.table.address") },
  { key: "quota", label: t("recipients.table.quota") },
  { key: "usedBytes", label: t("recipients.table.used") },
  { key: "active", label: t("recipients.table.active") },
]);

const columns = computed(() => [
  { accessorKey: "email", header: header("email", t("recipients.table.address")) },
  { accessorKey: "quota", header: header("quota", t("recipients.table.quota")) },
  { accessorKey: "usedBytes", header: header("usedBytes", t("recipients.table.used")) },
  { accessorKey: "active", header: header("active", t("recipients.table.active")) },
  { id: "actions", header: "" },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: domainFqdn.value, to: `/domains/${domainFqdn.value}` },
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
const { editModalOpen, editModalItem, editSaving, canEditRecipients, openEditModal, saveEdit } = useRecipientEdit(domainId, load);

function isPostmaster(item: Recipient) {
  return item.email.toLowerCase().startsWith("postmaster@");
}

function occupancyPercent(r: Recipient) {
  const quota = Number(r.quota);
  if (!Number.isFinite(quota) || quota <= 0) return 0;
  return Math.min(100, (Number(r.usedBytes) / quota) * 100);
}

function occupancyColor(r: Recipient) {
  const pct = occupancyPercent(r);
  if (pct > 90) return "error";
  if (pct > 70) return "warning";
  return "success";
}

async function create() {
  if (!domainId.value) return;
  if (quotaUnderLimit.value) {
    toast.add({ title: t("recipients.toast.quotaTooLow", { value: MIN_QUOTA_MB }), color: "error" });
    return;
  }
  try {
    await call(`/domains/${domainId.value}/recipients`, {
      method: "POST",
      body: {
        localPart: form.localPart,
        password: form.password,
        quota: form.quotaMb * MB,
      },
    });
    form.localPart = "";
    form.password = "";
    await load();
    toast.add({ title: t("recipients.toast.created"), color: "success" });
  } catch (err) {
    toast.add({
      title: t("recipients.toast.createFailed"),
      description: (err as Error).message,
      color: "error",
    });
  }
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
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        :title="t('recipients.alertTitle')"
        :description="t('recipients.alertDescription')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="() => load()" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("recipients.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end" @submit="create">
        <UFormField :label="t('recipients.form.localPart')" name="localPart">
          <UInput v-model="form.localPart" placeholder="local-part" class="w-full" />
        </UFormField>
        <UFormField :label="t('recipients.form.password')" name="password">
          <UInput v-model="form.password" type="password" :placeholder="t('recipients.form.password')" class="w-full" />
        </UFormField>
        <UFormField
          :label="t('recipients.form.quotaMb')"
          name="quotaMb"
          :error="quotaUnderLimit ? t('recipients.form.quotaMin', { value: MIN_QUOTA_MB }) : undefined"
        >
          <UInput v-model.number="form.quotaMb" type="number" :min="MIN_QUOTA_MB" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" :disabled="quotaUnderLimit" block class="lg:w-auto">{{
          t("recipients.form.submit")
        }}</UButton>
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
          <template #email-cell="{ row }">
            <div class="flex items-center gap-2">
              <span>{{ row.original.email }}</span>
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
                :model-value="occupancyPercent(row.original)"
                :color="occupancyColor(row.original)"
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
          <template #actions-cell="{ row }">
            <div v-if="!isPostmaster(row.original)" class="flex justify-end gap-2">
              <UButton
                v-if="canEditRecipients"
                icon="i-lucide-pencil"
                color="primary"
                variant="ghost"
                size="xs"
                square
                @click="openEditModal(row.original)"
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

      <div class="lg:hidden space-y-3">
        <p v-if="items.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <RecipientCard
          v-for="item in items"
          v-else
          :key="item.id"
          :item="item"
          :is-postmaster="isPostmaster(item)"
          :can-edit="canEditRecipients"
          @delete="requestDelete(() => remove(item))"
          @edit="openEditModal(item)"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />

    <RecipientEditModal
      v-if="editModalItem"
      v-model:open="editModalOpen"
      :item="editModalItem"
      :saving="editSaving"
      :min-quota-mb="MIN_QUOTA_MB"
      @save="saveEdit"
    />
  </div>
</template>
