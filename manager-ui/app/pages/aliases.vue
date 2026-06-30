<script setup lang="ts">
definePageMeta({});

interface Alias {
  id: number;
  source: string;
  destination: string;
  domain: string;
}
interface Domain {
  id: number;
  domain: string;
}

const domains = ref<Domain[]>([]);
const items = ref<Alias[]>([]);
const loading = ref(false);
const form = reactive({ domainId: 0, localPart: "", destination: "" });

const { call } = useApi();
const toast = useToast();

const columns = [
  { accessorKey: "source", header: "From" },
  { accessorKey: "destination", header: "To" },
  { accessorKey: "domain", header: "Domain" },
];

async function load() {
  loading.value = true;
  try {
    domains.value = await call<Domain[]>("/domains");
    const first = domains.value[0];
    if (!form.domainId && first) form.domainId = first.id;
    const lists = await Promise.all(domains.value.map((d) => call<Alias[]>(`/domains/${d.id}/aliases`)));
    items.value = lists.flat();
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (!form.domainId) {
    toast.add({ title: "Pick a domain first", color: "error" });
    return;
  }
  try {
    await call(`/domains/${form.domainId}/aliases`, {
      method: "POST",
      body: { localPart: form.localPart, destination: form.destination },
    });
    form.localPart = "";
    form.destination = "";
    await load();
    toast.add({ title: "Alias created", color: "success" });
  } catch (err) {
    toast.add({ title: "Create failed", description: (err as Error).message, color: "error" });
  }
}

function domainIdFor(row: Alias) {
  return domains.value.find((d) => d.domain === row.domain)?.id ?? null;
}

async function remove(row: Alias) {
  const id = domainIdFor(row);
  if (!id) return;
  await call(`/domains/${id}/aliases/${row.id}`, { method: "DELETE" });
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
        title="Forward an address (or a whole domain) to one or more real recipients."
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Add an alias</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end" @submit="create">
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
        <UFormField label="Destination" name="destination">
          <UInput v-model="form.destination" placeholder="real@example.com" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" block class="lg:w-auto">Add</UButton>
      </UForm>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="mt-6">
      <UTable :columns="columns" :data="items" :loading="loading" sticky>
        <template #actions-cell="{ row }">
          <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" square @click="remove(row.original)" />
        </template>
      </UTable>
    </UCard>
  </div>
</template>
