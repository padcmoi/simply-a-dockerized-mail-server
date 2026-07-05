<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "aliases", action: "access" },
    { resource: "aliases", action: "read" },
  ],
});

interface Alias {
  id: number;
  source: string;
  destination: string;
  domain: string;
}

const items = ref<Alias[]>([]);
const loading = ref(false);
const confirmOpen = ref(false);
const pendingDeleteFn = ref<(() => Promise<void>) | null>(null);
const form = reactive({ localPart: "", destination: "" });

const columns = computed(() => [
  { accessorKey: "source", header: t("aliases.table.from") },
  { accessorKey: "destination", header: t("aliases.table.to") },
  { id: "actions", header: "" },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const domainStore = useDomainStore();
const { set: setBreadcrumb } = useBreadcrumb();

watch(useDataRefresh().tick, load);

watchEffect(() => {
  const d = domainStore.selected;
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: d?.domain ?? "...", to: d ? `/domains/${d.domain}` : "/domains" },
    { label: t("nav.aliases") },
  ]);
});

async function load() {
  loading.value = true;
  try {
    items.value = await call<Alias[]>(`/domains/${domainStore.selected!.id}/aliases`);
  } finally {
    loading.value = false;
  }
}

async function create() {
  try {
    await call(`/domains/${domainStore.selected!.id}/aliases`, {
      method: "POST",
      body: { localPart: form.localPart, destination: form.destination },
    });
    form.localPart = "";
    form.destination = "";
    await load();
    toast.add({ title: t("aliases.toast.created"), color: "success" });
  } catch (err) {
    toast.add({
      title: t("aliases.toast.createFailed"),
      description: (err as Error).message,
      color: "error",
    });
  }
}

async function remove(row: Alias) {
  await call(`/domains/${domainStore.selected!.id}/aliases/${row.id}`, {
    method: "DELETE",
  });
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
        :title="t('aliases.alertTitle')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("aliases.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end" @submit="create">
        <UFormField :label="t('aliases.form.localPart')" name="localPart">
          <UInput v-model="form.localPart" placeholder="local-part" class="w-full" />
        </UFormField>
        <UFormField :label="t('aliases.form.destination')" name="destination">
          <UInput v-model="form.destination" :placeholder="t('aliases.form.destinationPlaceholder')" class="w-full" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" block class="sm:w-auto">{{ t("aliases.form.submit") }}</UButton>
      </UForm>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
      <UTable :columns="columns" :data="items" :loading="loading" sticky>
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
      <AliasCard v-for="item in items" v-else :key="item.id" :item="item" @delete="requestDelete(() => remove(item))" />
    </div>

    <ConfirmModal v-model:open="confirmOpen" @confirm="onDeleteConfirmed" />
  </div>
</template>
