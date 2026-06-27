<script setup lang="ts">
interface Alias {
  id: number;
  source: string;
  destination: string;
  domain: string;
}

const { call } = useApi();
const toast = useToast();
const items = ref<Alias[]>([]);
const loading = ref(false);
const form = reactive({ source: "", destination: "" });

async function load() {
  loading.value = true;
  try {
    items.value = await call<Alias[]>("/aliases");
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function create() {
  try {
    await call("/aliases", { method: "POST", body: form });
    form.source = "";
    form.destination = "";
    await load();
    toast.add({ title: "Alias created", color: "success" });
  } catch (err) {
    toast.add({ title: "Create failed", description: (err as Error).message, color: "error" });
  }
}
async function remove(id: number) {
  await call(`/aliases/${id}`, { method: "DELETE" });
  await load();
}

const columns = [
  { accessorKey: "source", header: "From" },
  { accessorKey: "destination", header: "To" },
  { accessorKey: "domain", header: "Domain" },
];
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">Aliases</h1>
    <UCard>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <UInput v-model="form.source" placeholder="alias@example.com" />
        <UInput v-model="form.destination" placeholder="real@example.com" />
        <UButton icon="i-lucide-plus" @click="create">Add</UButton>
      </div>
    </UCard>
    <UTable :columns="columns" :data="items" :loading="loading">
      <template #actions-cell="{ row }">
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="remove(row.original.id)" />
      </template>
    </UTable>
  </div>
</template>
