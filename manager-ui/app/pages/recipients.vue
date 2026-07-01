<script setup lang="ts">
definePageMeta({});

interface Recipient {
  id: number;
  email: string;
  quota: string;
  active: number;
}

const items = ref<Recipient[]>([]);
const loading = ref(false);
const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);
const form = reactive({ localPart: "", password: "", quota: 524288000 });

const columns = computed(() => [
  { accessorKey: "email", header: t("recipients.table.address") },
  { accessorKey: "quota", header: t("recipients.table.quota") },
  { accessorKey: "active", header: t("recipients.table.active") },
  { id: "actions", header: "" },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const domainStore = useDomainStore();
const { set: setBreadcrumb } = useBreadcrumb();

watchEffect(() => {
  const d = domainStore.selected;
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: d?.domain ?? "...", to: d ? `/domains/${d.domain}` : "/domains" },
    { label: t("nav.recipients") },
  ]);
});

async function load() {
  loading.value = true;
  try {
    items.value = await call<Recipient[]>(`/domains/${domainStore.selected!.id}/recipients`);
  } finally {
    loading.value = false;
  }
}

async function create() {
  try {
    await call(`/domains/${domainStore.selected!.id}/recipients`, {
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

async function remove(row: Recipient) {
  await call(`/domains/${domainStore.selected!.id}/recipients/${row.id}`, { method: "DELETE" });
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
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end" @submit="create">
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
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            square
            @click="requestDelete(() => remove(row.original))"
          />
        </template>
      </UTable>
    </UCard>

    <div class="lg:hidden space-y-3">
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="items.length === 0" class="text-sm text-muted text-center py-6">-</p>
      <RecipientCard v-for="item in items" v-else :key="item.id" :item="item" @delete="requestDelete(() => remove(item))" />
    </div>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />
  </div>
</template>
