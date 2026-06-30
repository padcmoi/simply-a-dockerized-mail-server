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

const { call } = useApi();

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

async function load() {
  loading.value = true;
  try {
    const domains = await call<Domain[]>("/domains");
    const snapshots = await Promise.all(domains.map((d) => call<DomainQuotaPayload>(`/domains/${d.id}/quotas`)));
    // Plain loop instead of `.filter((d): d is QuotaRow => d !== null)` so we
    // narrow to QuotaRow without an explicit return-type annotation (banned
    // by the gestlok no-restricted-syntax rule).
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
        title="Live mailbox usage maintained by the dovecot dict-sql backend."
        class="flex-1 min-w-[16rem]"
      />
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <h2 class="font-semibold">Per domain</h2>
      </template>
      <UTable :columns="domainCols" :data="domainRows" :loading="loading" sticky />
    </UCard>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="mt-6">
      <template #header>
        <h2 class="font-semibold">Per recipient</h2>
      </template>
      <UTable :columns="recipientCols" :data="recipientRows" :loading="loading" sticky />
    </UCard>
  </div>
</template>
