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

const columns = computed(() => [
  { accessorKey: "source", header: t("aliases.table.from") },
  { accessorKey: "destination", header: t("aliases.table.to") },
  { accessorKey: "domain", header: t("aliases.table.domain") },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();

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
    toast.add({ title: t("aliases.toast.pickDomain"), color: "error" });
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
    toast.add({ title: t("aliases.toast.created"), color: "success" });
  } catch (err) {
    toast.add({ title: t("aliases.toast.createFailed"), description: (err as Error).message, color: "error" });
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
        :title="t('aliases.alertTitle')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("aliases.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end" @submit="create">
        <UFormField :label="t('aliases.form.domain')" name="domainId">
          <USelect
            v-model="form.domainId"
            :items="domains.map((d) => ({ label: d.domain, value: d.id }))"
            :placeholder="t('aliases.form.domainPlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('aliases.form.localPart')" name="localPart">
          <UInput v-model="form.localPart" placeholder="local-part" class="w-full" />
        </UFormField>
        <UFormField :label="t('aliases.form.destination')" name="destination">
          <UInput v-model="form.destination" :placeholder="t('aliases.form.destinationPlaceholder')" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" block class="lg:w-auto">{{ t("aliases.form.submit") }}</UButton>
      </UForm>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
      <UTable :columns="columns" :data="items" :loading="loading" sticky>
        <template #actions-cell="{ row }">
          <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" square @click="remove(row.original)" />
        </template>
      </UTable>
    </UCard>

    <div class="lg:hidden space-y-3">
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="items.length === 0" class="text-sm text-muted text-center py-6">-</p>
      <AliasCard v-for="item in items" v-else :key="item.id" :item="item" @delete="remove(item)" />
    </div>
  </div>
</template>
