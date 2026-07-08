<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "sieve", action: "access" },
    { resource: "sieve", action: "read" },
  ],
});

interface Reject {
  id: number;
  sender: string;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);
const form = reactive({ sender: "" });

// Same source feeds the desktop column headers below and ListToolbar's
// mobile sort select.
const SORTABLE_COLUMNS = computed(() => [
  { key: "sender", label: t("sieve.table.sender") },
  { key: "enabled", label: t("sieve.table.enabled") },
  { key: "createdAt", label: t("sieve.table.created") },
  { key: "updatedAt", label: t("sieve.table.updated") },
]);

const columns = computed(() => [
  { accessorKey: "sender", header: header("sender", t("sieve.table.sender")) },
  { accessorKey: "enabled", header: header("enabled", t("sieve.table.enabled")) },
  { accessorKey: "createdAt", header: header("createdAt", t("sieve.table.created")) },
  { accessorKey: "updatedAt", header: header("updatedAt", t("sieve.table.updated")) },
  { id: "actions", header: "" },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.sieveLong") }]);

const { items, total, loading, hasLoadedOnce, page, limit, search, sortBy, sortDir, load } = usePaginatedList<Reject>(
  "sieve-reject-senders-list",
  "/sieve/reject-senders",
  "createdAt"
);
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

async function create() {
  try {
    await call("/sieve/reject-senders", { method: "POST", body: form });
    form.sender = "";
    await load();
    toast.add({ title: t("sieve.toast.blocked"), color: "success" });
  } catch (err) {
    toast.add({
      title: t("sieve.toast.failed"),
      description: (err as Error).message,
      color: "error",
    });
  }
}

async function toggle(id: number, enabled: number) {
  await call(`/sieve/reject-senders/${id}`, {
    method: "PATCH",
    body: { enabled: !enabled },
  });
  await load();
}

async function remove(id: number) {
  await call(`/sieve/reject-senders/${id}`, { method: "DELETE" });
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
      <UAlert color="neutral" variant="subtle" icon="i-lucide-info" :title="t('sieve.alertTitle')" class="flex-1 min-w-[16rem]" />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="() => load()" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("sieve.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end" @submit="create">
        <UFormField :label="t('sieve.form.sender')" name="sender">
          <UInput v-model="form.sender" :placeholder="t('sieve.form.senderPlaceholder')" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-shield-x" :disabled="!form.sender" block class="sm:w-auto">
          {{ t("sieve.form.submit") }}
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
          <template #enabled-cell="{ row }">
            <USwitch :model-value="!!row.original.enabled" @update:model-value="toggle(row.original.id, row.original.enabled)" />
          </template>
          <template #actions-cell="{ row }">
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              square
              @click="requestDelete(() => remove(row.original.id))"
            />
          </template>
        </UTable>
      </UCard>

      <div class="lg:hidden space-y-3">
        <p v-if="items.length === 0" class="text-sm text-muted text-center py-6">{{ t("common.noResults") }}</p>
        <SieveRuleCard
          v-for="item in items"
          v-else
          :key="item.id"
          :item="item"
          @delete="requestDelete(() => remove(item.id))"
          @toggle="toggle(item.id, item.enabled)"
        />
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />
  </div>
</template>
