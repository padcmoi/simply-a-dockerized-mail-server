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
interface Domain {
  id: number;
  domain: string;
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

async function load() {
  loading.value = true;
  try {
    const domains = await call<Domain[]>("/domains");
    const snapshots = await Promise.all(domains.map((d) => call<DomainQuotaPayload>(`/domains/${d.id}/quotas`)));
    const doms: QuotaRow[] = [];
    for (const s of snapshots) if (s.domain) doms.push(s.domain);
    domainRows.value = doms;
    recipientRows.value = snapshots.flatMap((s) => s.recipients);
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

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <h2 class="font-semibold">{{ t("quotas.perDomain") }}</h2>
      </template>
      <UTable :columns="domainCols" :data="domainRows" :loading="loading" sticky />
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="mt-6">
      <template #header>
        <h2 class="font-semibold">{{ t("quotas.perRecipient") }}</h2>
      </template>
      <UTable :columns="recipientCols" :data="recipientRows" :loading="loading" sticky />
    </UCard>
  </div>
</template>
