<script setup lang="ts">
definePageMeta({});

interface Domain {
  id: number;
  domain: string;
  quota: string;
  active: number;
}
interface Disk {
  totalBytes: number;
  freeBytes: number;
  reservedBytes: number;
  assignableBytes: number;
}

const MB = 1024 * 1024;

const items = ref<Domain[]>([]);
const disk = ref<Disk | null>(null);
const loading = ref(false);
const form = reactive({ domain: "", active: true, quotaMb: 0 });

const assignableMb = computed(() => (disk.value ? Math.floor(disk.value.assignableBytes / MB) : 0));
const totalGb = computed(() => (disk.value ? (disk.value.totalBytes / (1024 * 1024 * 1024)).toFixed(1) : "0.0"));
const freeGb = computed(() => (disk.value ? (disk.value.freeBytes / (1024 * 1024 * 1024)).toFixed(1) : "0.0"));
const reservedGb = computed(() => (disk.value ? (disk.value.reservedBytes / (1024 * 1024 * 1024)).toFixed(1) : "0.0"));
const assignableGb = computed(() => (disk.value ? (disk.value.assignableBytes / (1024 * 1024 * 1024)).toFixed(1) : "0.0"));
const quotaOverLimit = computed(() => form.quotaMb > assignableMb.value);
const columns = computed(() => [
  { accessorKey: "id", header: t("domains.table.id") },
  { accessorKey: "domain", header: t("domains.table.domain") },
  { accessorKey: "active", header: t("domains.table.active") },
  { accessorKey: "quota", header: t("domains.table.quotaMb") },
]);

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();

async function load() {
  loading.value = true;
  try {
    const [list, d] = await Promise.all([call<Domain[]>("/domains"), call<Disk>("/domains/disk")]);
    items.value = list;
    disk.value = d;
  } catch (err) {
    toast.add({ title: t("domains.toast.loadFailed"), description: (err as Error).message, color: "error" });
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (quotaOverLimit.value) {
    toast.add({ title: t("domains.toast.quotaTooHigh"), color: "error" });
    return;
  }
  try {
    await call("/domains", {
      method: "POST",
      body: { domain: form.domain, active: form.active, quota: form.quotaMb * MB },
    });
    form.domain = "";
    form.quotaMb = 0;
    await load();
    toast.add({ title: t("domains.toast.added"), color: "success" });
  } catch (err) {
    toast.add({ title: t("domains.toast.addFailed"), description: (err as Error).message, color: "error" });
  }
}

async function remove(id: number) {
  await call(`/domains/${id}`, { method: "DELETE" });
  await load();
}

function quotaToMb(raw: string) {
  const bytes = Number(raw);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0";
  return String(Math.round(bytes / MB));
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
        :title="t('domains.alertTitle')"
        :description="t('domains.alertDescription')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold">{{ t("domains.capacity.title") }}</h2>
          <span class="text-sm text-dimmed">{{ t("domains.capacity.hint") }}</span>
        </div>
      </template>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p class="text-dimmed">{{ t("domains.capacity.total") }}</p>
          <p class="font-semibold">{{ totalGb }} GB</p>
        </div>
        <div>
          <p class="text-dimmed">{{ t("domains.capacity.free") }}</p>
          <p class="font-semibold">{{ freeGb }} GB</p>
        </div>
        <div>
          <p class="text-dimmed">{{ t("domains.capacity.reserved") }}</p>
          <p class="font-semibold">{{ reservedGb }} GB</p>
        </div>
        <div>
          <p class="text-dimmed">{{ t("domains.capacity.assignable") }}</p>
          <p class="font-semibold text-primary">{{ assignableGb }} GB</p>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("domains.form.title") }}</h2>
      </template>
      <UForm :state="form" class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end" @submit="create">
        <UFormField :label="t('domains.form.fqdn')" name="domain">
          <UInput v-model="form.domain" placeholder="example.com" icon="i-lucide-globe" class="w-full" />
        </UFormField>
        <UFormField
          :label="t('domains.form.quotaMb')"
          name="quotaMb"
          :error="quotaOverLimit ? t('domains.form.quotaMax', { value: assignableMb }) : undefined"
          :hint="t('domains.form.quotaMax', { value: assignableMb })"
        >
          <UInput v-model.number="form.quotaMb" type="number" min="0" :max="assignableMb" class="w-32" />
        </UFormField>
        <UFormField :label="t('domains.form.active')" name="active">
          <USwitch v-model="form.active" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" :disabled="!form.domain || quotaOverLimit" block class="sm:w-auto">
          {{ t("domains.form.submit") }}
        </UButton>
      </UForm>
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="mt-6">
      <UTable :columns="columns" :data="items" :loading="loading" sticky>
        <template #active-cell="{ row }">
          <UBadge :color="row.original.active ? 'success' : 'neutral'" variant="subtle">
            {{ row.original.active ? t("common.yes") : t("common.no") }}
          </UBadge>
        </template>
        <template #quota-cell="{ row }">
          {{ quotaToMb(row.original.quota) }}
        </template>
        <template #actions-cell="{ row }">
          <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" square @click="remove(row.original.id)" />
        </template>
      </UTable>
    </UCard>
  </div>
</template>
