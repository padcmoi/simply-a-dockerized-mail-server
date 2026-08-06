<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
definePageMeta({
  requiredGlobal: [
    { resource: "sieve", action: "access" },
    { resource: "sieve", action: "list-reject-senders" },
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

// Declared once for both renderings, which DataTable chooses between on its own
// width rather than this page carrying one of each.
const columns = computed<DataTableColumn<Reject>[]>(() => [
  { key: "sender", label: t("sieve.table.sender"), value: (row) => row.sender, primary: true },
  { key: "enabled", label: t("sieve.table.enabled"), value: (row) => row.enabled === 1 },
  { key: "createdAt", label: t("sieve.table.created"), value: (row) => row.createdAt },
  { key: "updatedAt", label: t("sieve.table.updated"), value: (row) => row.updatedAt },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
const { formatDateTime } = useDateTime();

setBreadcrumb([{ label: t("layout.sieveLong") }]);

const { items, total, loading, hasLoadedOnce, page, limit, search, sortBy, sortDir, load } = usePaginatedList<Reject>(
  "sieve-reject-senders-list",
  "/sieve/reject-senders",
  "createdAt"
);

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
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-info" :title="t('sieve.alertTitle')" />

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("sieve.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start" @submit="create">
        <UFormField :label="t('sieve.form.sender')" name="sender">
          <UInput v-model="form.sender" :placeholder="t('sieve.form.senderPlaceholder')" class="w-full" />
        </UFormField>
        <!-- Empty label row so the button lines up with the inputs rather than
             with their labels, the grid being top-aligned. UFormField only
             renders its label element when the prop is truthy. -->
        <UFormField label="&#160;">
          <UButton type="submit" icon="i-lucide-shield-x" :disabled="!form.sender" block class="sm:w-auto">
            {{ t("sieve.form.submit") }}
          </UButton>
        </UFormField>
      </UForm>
    </UCard>

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
      :row-key="(row: Reject) => row.id"
      :empty-label="t('common.noResults')"
    >
      <template #enabled="{ row }">
        <USwitch :model-value="!!row.enabled" @update:model-value="toggle(row.id, row.enabled)" />
      </template>

      <template #createdAt="{ row }">
        <span class="text-muted">{{ formatDateTime(row.createdAt) }}</span>
      </template>

      <template #updatedAt="{ row }">
        <span class="text-muted">{{ formatDateTime(row.updatedAt) }}</span>
      </template>

      <template #actions="{ row }">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          square
          @click="requestDelete(() => remove(row.id))"
        />
      </template>
    </DataTable>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />
  </div>
</template>
