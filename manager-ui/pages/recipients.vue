<script setup lang="ts">
interface Recipient {
  id: number;
  email: string;
  domain: string;
  quota: string;
  active: number;
}
interface Domain {
  id: number;
  domain: string;
}

const { call } = useApi();
const toast = useToast();
const domains = ref<Domain[]>([]);
const items = ref<Recipient[]>([]);
const loading = ref(false);
const form = reactive({ domainId: 0, localPart: "", password: "", quota: 524288000 });

async function load() {
  loading.value = true;
  try {
    domains.value = await call<Domain[]>("/domains");
    if (!form.domainId && domains.value.length) form.domainId = domains.value[0].id;
    const lists = await Promise.all(domains.value.map((d) => call<Recipient[]>(`/domains/${d.id}/recipients`)));
    items.value = lists.flat();
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function create() {
  if (!form.domainId) {
    toast.add({ title: "Pick a domain first", color: "error" });
    return;
  }
  try {
    await call(`/domains/${form.domainId}/recipients`, {
      method: "POST",
      body: { localPart: form.localPart, password: form.password, quota: form.quota },
    });
    form.localPart = "";
    form.password = "";
    await load();
    toast.add({ title: "Recipient created", color: "success" });
  } catch (err) {
    toast.add({ title: "Create failed", description: (err as Error).message, color: "error" });
  }
}

function domainIdFor(row: Recipient): number | null {
  return domains.value.find((d) => d.domain === row.domain)?.id ?? null;
}

async function remove(row: Recipient) {
  const id = domainIdFor(row);
  if (!id) return;
  await call(`/domains/${id}/recipients/${row.id}`, { method: "DELETE" });
  await load();
}

const columns = [
  { accessorKey: "email", header: "Address" },
  { accessorKey: "domain", header: "Domain" },
  { accessorKey: "quota", header: "Quota" },
  { accessorKey: "active", header: "Active" },
];
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">Recipients</h1>
    <UCard>
      <div class="grid grid-cols-1 sm:grid-cols-5 gap-2">
        <USelect
          v-model="form.domainId"
          :items="domains.map((d) => ({ label: d.domain, value: d.id }))"
          placeholder="Domain"
        />
        <UInput v-model="form.localPart" placeholder="local-part" />
        <UInput v-model="form.password" type="password" placeholder="Password" />
        <UInput v-model.number="form.quota" type="number" placeholder="Quota (bytes)" />
        <UButton icon="i-lucide-plus" @click="create">Create</UButton>
      </div>
    </UCard>
    <UTable :columns="columns" :data="items" :loading="loading">
      <template #actions-cell="{ row }">
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="remove(row.original)" />
      </template>
    </UTable>
  </div>
</template>
