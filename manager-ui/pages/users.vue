<script setup lang="ts">
interface User {
  id: number;
  email: string;
  domain: string;
  quota: string;
  active: number;
}

const { call } = useApi();
const toast = useToast();
const items = ref<User[]>([]);
const loading = ref(false);
const form = reactive({ email: "", password: "", quota: 524288000 });

async function load() {
  loading.value = true;
  try {
    items.value = await call<User[]>("/users");
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function create() {
  try {
    await call("/users", { method: "POST", body: form });
    form.email = "";
    form.password = "";
    await load();
    toast.add({ title: "Mailbox created", color: "success" });
  } catch (err) {
    toast.add({ title: "Create failed", description: (err as Error).message, color: "error" });
  }
}
async function remove(id: number) {
  await call(`/users/${id}`, { method: "DELETE" });
  await load();
}

const columns = [
  { accessorKey: "email", header: "Email" },
  { accessorKey: "domain", header: "Domain" },
  { accessorKey: "quota", header: "Quota" },
  { accessorKey: "active", header: "Active" },
];
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">Mailboxes</h1>
    <UCard>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <UInput v-model="form.email" placeholder="user@example.com" />
        <UInput v-model="form.password" type="password" placeholder="Password" />
        <UInput v-model.number="form.quota" type="number" placeholder="Quota (bytes)" />
        <UButton icon="i-lucide-plus" @click="create">Create</UButton>
      </div>
    </UCard>
    <UTable :columns="columns" :data="items" :loading="loading">
      <template #actions-cell="{ row }">
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="remove(row.original.id)" />
      </template>
    </UTable>
  </div>
</template>
