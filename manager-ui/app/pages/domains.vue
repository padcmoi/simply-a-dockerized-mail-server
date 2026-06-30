<script setup lang="ts">
definePageMeta({});

interface Domain {
  id: number;
  domain: string;
  quota: string;
  active: number;
}

const items = ref<Domain[]>([]);
const loading = ref(false);
const form = reactive({ domain: "", active: true });

const { call } = useApi();
const toast = useToast();

const columns = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "domain", header: "Domain" },
  { accessorKey: "active", header: "Active" },
  { accessorKey: "quota", header: "Quota" },
];

async function load() {
  loading.value = true;
  try {
    items.value = await call<Domain[]>("/domains");
  } catch (err) {
    toast.add({ title: "Failed", description: (err as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

async function create() {
  try {
    await call("/domains", { method: "POST", body: form });
    form.domain = "";
    await load();
    toast.add({ title: "Domain added", color: "success" });
  } catch (err) {
    toast.add({ title: "Add failed", description: (err as Error).message, color: "error" });
  }
}

async function remove(id: number) {
  await call(`/domains/${id}`, { method: "DELETE" });
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
        title="Mail domains served by postfix."
        description="Creating one provisions the inactive postmaster and the DKIM key."
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Add a domain</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end" @submit="create">
        <UFormField label="FQDN" name="domain">
          <UInput v-model="form.domain" placeholder="example.com" icon="i-lucide-globe" class="w-full" />
        </UFormField>
        <UFormField label="Active" name="active">
          <USwitch v-model="form.active" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" :disabled="!form.domain" block class="sm:w-auto"> Add </UButton>
      </UForm>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="mt-6">
      <UTable :columns="columns" :data="items" :loading="loading" sticky>
        <template #active-cell="{ row }">
          <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
            {{ row.original.active ? "Yes" : "No" }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" square @click="remove(row.original.id)" />
        </template>
      </UTable>
    </UCard>
  </div>
</template>
