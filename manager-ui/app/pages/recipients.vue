<script setup lang="ts">
definePageMeta({});

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

const domains = ref<Domain[]>([]);
const items = ref<Recipient[]>([]);
const loading = ref(false);
const form = reactive({ domainId: 0, localPart: "", password: "", quota: 524288000 });

const columns = computed(() => [
  { accessorKey: "email", header: t("recipients.table.address") },
  { accessorKey: "domain", header: t("recipients.table.domain") },
  { accessorKey: "quota", header: t("recipients.table.quota") },
  { accessorKey: "active", header: t("recipients.table.active") },
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
    const lists = await Promise.all(domains.value.map((d) => call<Recipient[]>(`/domains/${d.id}/recipients`)));
    items.value = lists.flat();
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (!form.domainId) {
    toast.add({ title: t("recipients.toast.pickDomain"), color: "error" });
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
    toast.add({ title: t("recipients.toast.created"), color: "success" });
  } catch (err) {
    toast.add({ title: t("recipients.toast.createFailed"), description: (err as Error).message, color: "error" });
  }
}

function domainIdFor(row: Recipient) {
  return domains.value.find((d) => d.domain === row.domain)?.id ?? null;
}

async function remove(row: Recipient) {
  const id = domainIdFor(row);
  if (!id) return;
  await call(`/domains/${id}/recipients/${row.id}`, { method: "DELETE" });
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
        :title="t('recipients.alertTitle')"
        :description="t('recipients.alertDescription')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("recipients.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" @submit="create">
        <UFormField :label="t('recipients.form.domain')" name="domainId">
          <USelect
            v-model="form.domainId"
            :items="domains.map((d) => ({ label: d.domain, value: d.id }))"
            :placeholder="t('recipients.form.domainPlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('recipients.form.localPart')" name="localPart">
          <UInput v-model="form.localPart" placeholder="local-part" class="w-full" />
        </UFormField>
        <UFormField :label="t('recipients.form.password')" name="password">
          <UInput v-model="form.password" type="password" :placeholder="t('recipients.form.password')" class="w-full" />
        </UFormField>
        <UFormField :label="t('recipients.form.quotaBytes')" name="quota">
          <UInput v-model.number="form.quota" type="number" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" block class="lg:w-auto">{{ t("recipients.form.submit") }}</UButton>
      </UForm>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
      <UTable :columns="columns" :data="items" :loading="loading" sticky>
        <template #active-cell="{ row }">
          <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
            {{ row.original.active ? t("common.yes") : t("common.no") }}
          </UBadge>
        </template>
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
      <RecipientCard v-for="item in items" v-else :key="item.id" :item="item" @delete="remove(item)" />
    </div>
  </div>
</template>
