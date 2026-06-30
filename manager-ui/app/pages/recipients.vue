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
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="Mailbox addresses (local-part@domain destinations postfix delivers to)."
        description="Passwords are hashed with SHA512-CRYPT before storage."
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Add a recipient</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" @submit="create">
        <UFormField label="Domain" name="domainId">
          <USelect
            v-model="form.domainId"
            :items="domains.map((d) => ({ label: d.domain, value: d.id }))"
            placeholder="Pick a domain"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Local part" name="localPart">
          <UInput v-model="form.localPart" placeholder="local-part" class="w-full" />
        </UFormField>
        <UFormField label="Password" name="password">
          <UInput v-model="form.password" type="password" placeholder="Password" class="w-full" />
        </UFormField>
        <UFormField label="Quota (bytes)" name="quota">
          <UInput v-model.number="form.quota" type="number" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" block class="lg:w-auto">Create</UButton>
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
          <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" square @click="remove(row.original)" />
        </template>
      </UTable>
    </UCard>
  </div>
</template>
