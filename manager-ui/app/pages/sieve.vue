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

const { call } = useApi();
const toast = useToast();

const columns = [
  { accessorKey: "sender", header: "Sender" },
  { accessorKey: "enabled", header: "Enabled" },
  { accessorKey: "createdAt", header: "Created" },
];

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
    toast.add({ title: "Sender blocked", color: "success" });
  } catch (err) {
    toast.add({ title: "Failed", description: (err as Error).message, color: "error" });
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

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="SQL blacklist enforced by postfix at MAIL FROM time."
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Block a sender</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end" @submit="create">
        <UFormField label="Sender" name="sender">
          <UInput v-model="form.sender" placeholder="@spamdomain.com or full@address.com" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-shield-x" :disabled="!form.sender" block class="sm:w-auto"> Block </UButton>
      </UForm>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="mt-6">
      <UTable :columns="columns" :data="items" :loading="loading" sticky>
        <template #enabled-cell="{ row }">
          <USwitch :model-value="!!row.original.enabled" @update:model-value="toggle(row.original.id, row.original.enabled)" />
        </template>
        <template #actions-cell="{ row }">
          <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" square @click="remove(row.original.id)" />
        </template>
      </UTable>
    </UCard>
  </div>
</template>
