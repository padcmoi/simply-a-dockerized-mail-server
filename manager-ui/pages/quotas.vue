<script setup lang="ts">
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

const { call } = useApi();
const domainRows = ref<QuotaRow[]>([]);
const recipientRows = ref<QuotaRow[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const domains = await call<Domain[]>("/domains");
    const snapshots = await Promise.all(domains.map((d) => call<DomainQuotaPayload>(`/domains/${d.id}/quotas`)));
    domainRows.value = snapshots.map((s) => s.domain).filter((d): d is QuotaRow => d !== null);
    recipientRows.value = snapshots.flatMap((s) => s.recipients);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const domainCols = [
  { accessorKey: "domain", header: "Domain" },
  { accessorKey: "bytes", header: "Bytes" },
  { accessorKey: "messages", header: "Messages" },
  { accessorKey: "lastActivity", header: "Last activity" },
];
const recipientCols = [
  { accessorKey: "email", header: "Address" },
  { accessorKey: "bytes", header: "Bytes" },
  { accessorKey: "messages", header: "Messages" },
  { accessorKey: "lastActivity", header: "Last activity" },
];
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Quotas</h1>
      <UButton icon="i-lucide-refresh-cw" variant="ghost" :loading="loading" @click="load">Refresh</UButton>
    </div>
    <section class="space-y-2">
      <h2 class="text-lg font-medium">Per domain</h2>
      <UTable :columns="domainCols" :data="domainRows" :loading="loading" />
    </section>
    <section class="space-y-2">
      <h2 class="text-lg font-medium">Per recipient</h2>
      <UTable :columns="recipientCols" :data="recipientRows" :loading="loading" />
    </section>
  </div>
</template>
