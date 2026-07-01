<script setup lang="ts">
definePageMeta({});

interface Reject {
  id: number;
  sender: string;
  enabled: number;
  createdAt: string;
}

const items = ref<Reject[]>([]);
const loading = ref(false);
const form = reactive({ sender: "" });
const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);

const columns = computed(() => [
  { accessorKey: "sender", header: t("sieve.table.sender") },
  { accessorKey: "enabled", header: t("sieve.table.enabled") },
  { accessorKey: "createdAt", header: t("sieve.table.created") },
  { id: "actions", header: "" },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();

async function load() {
  loading.value = true;
  try {
    items.value = await call<Reject[]>("/sieve/reject-senders");
  } finally {
    loading.value = false;
  }
}

async function create() {
  try {
    await call("/sieve/reject-senders", { method: "POST", body: form });
    form.sender = "";
    await load();
    toast.add({ title: t("sieve.toast.blocked"), color: "success" });
  } catch (err) {
    toast.add({ title: t("sieve.toast.failed"), description: (err as Error).message, color: "error" });
  }
}

async function toggle(id: number, enabled: number) {
  await call(`/sieve/reject-senders/${id}`, { method: "PATCH", body: { enabled: !enabled } });
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

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert color="neutral" variant="subtle" icon="i-lucide-info" :title="t('sieve.alertTitle')" class="flex-1 min-w-[16rem]" />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
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
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="items.length === 0" class="text-sm text-muted text-center py-6">-</p>
      <SieveRuleCard
        v-for="item in items"
        v-else
        :key="item.id"
        :item="item"
        @delete="requestDelete(() => remove(item.id))"
        @toggle="toggle(item.id, item.enabled)"
      />
    </div>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />
  </div>
</template>
