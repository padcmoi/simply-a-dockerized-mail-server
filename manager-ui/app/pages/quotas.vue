<script setup lang="ts">
definePageMeta({});

interface QuotaRow {
  id: number;
  domain: string;
  email?: string;
  bytes: string;
  messages: string;
  lastActivity: string;
}
interface DomainQuotaPayload {
  domain: QuotaRow | null;
  recipients: QuotaRow[];
}

const domainRows = ref<QuotaRow[]>([]);
const recipientRows = ref<QuotaRow[]>([]);
const loading = ref(false);

const domainCols = computed(() => [
  { accessorKey: "domain", header: t("common.domain") },
  { accessorKey: "bytes", header: t("common.bytes") },
  { accessorKey: "messages", header: t("common.messages") },
  { accessorKey: "lastActivity", header: t("common.lastActivity") },
]);
const recipientCols = computed(() => [
  { accessorKey: "email", header: t("common.address") },
  { accessorKey: "bytes", header: t("common.bytes") },
  { accessorKey: "messages", header: t("common.messages") },
  { accessorKey: "lastActivity", header: t("common.lastActivity") },
]);

const { t } = useI18n();
const { call } = useApi();
const domainStore = useDomainStore();
const { set: setBreadcrumb } = useBreadcrumb();

watchEffect(() => {
  const d = domainStore.selected;
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: d?.domain ?? "...", to: d ? `/domains/${d.domain}` : "/domains" },
    { label: t("nav.quotas") },
  ]);
});

async function load() {
  loading.value = true;
  try {
    const data = await call<DomainQuotaPayload>(`/domains/${domainStore.selected!.id}/quotas`);
    domainRows.value = data.domain ? [data.domain] : [];
    recipientRows.value = data.recipients;
  } finally {
    loading.value = false;
  }
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
        :title="t('quotas.alertTitle')"
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
      <template #header>
        <h2 class="font-semibold">{{ t("quotas.perDomain") }}</h2>
      </template>
      <UTable :columns="domainCols" :data="domainRows" :loading="loading" sticky />
    </UCard>

    <div class="lg:hidden space-y-3">
      <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">{{ t("quotas.perDomain") }}</h2>
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="domainRows.length === 0" class="text-sm text-muted text-center py-6">-</p>
      <QuotaCard v-for="item in domainRows" v-else :key="item.id" :item="item" />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
      <template #header>
        <h2 class="font-semibold">{{ t("quotas.perRecipient") }}</h2>
      </template>
      <UTable :columns="recipientCols" :data="recipientRows" :loading="loading" sticky />
    </UCard>

    <div class="lg:hidden space-y-3">
      <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">{{ t("quotas.perRecipient") }}</h2>
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
      </div>
      <p v-else-if="recipientRows.length === 0" class="text-sm text-muted text-center py-6">-</p>
      <QuotaCard v-for="item in recipientRows" v-else :key="item.id" :item="item" />
    </div>
  </div>
</template>
