<script setup lang="ts">
definePageMeta({});

interface Domain {
  id: number;
  domain: string;
  quota: string;
  active: number;
}
interface Recipient {
  id: number;
  active: number;
}
interface Alias {
  id: number;
}
interface QuotaPayload {
  domain: { bytes: string; messages: string; lastActivity: string } | null;
  recipients: { id: number; email: string; bytes: string }[];
}

const route = useRoute();
const { call } = useApi();
const { t } = useI18n();
const domainStore = useDomainStore();
const { set: setBreadcrumb } = useBreadcrumb();

const domain = ref<Domain | null>(null);
const recipients = ref<Recipient[]>([]);
const aliases = ref<Alias[]>([]);
const quota = ref<{ bytes: string; messages: string; lastActivity: string } | null>(null);
const loading = ref(false);

const domainFqdn = computed(() => String(route.params.domain));

const activeRecipients = computed(() => recipients.value.filter((r) => r.active).length);
const quotaGb = computed(() => {
  const d = domain.value;
  if (!d) return "0";
  const bytes = Number(d.quota);
  if (!Number.isFinite(bytes) || bytes <= 0) return t("domains.capacity.hint").split("(")[0].trim();
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
});
const usedGb = computed(() => {
  const bytes = Number(quota.value?.bytes ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
});

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.domains"), to: "/domains" }, { label: domain.value?.domain ?? "..." }]);
});

async function load() {
  loading.value = true;
  try {
    const domains = await call<Domain[]>("/domains");
    const found = domains.find((d) => d.domain === domainFqdn.value) ?? null;
    domain.value = found;
    if (!found) return;
    domainStore.select(found);
    const [recs, als, quotaData] = await Promise.all([
      call<Recipient[]>(`/domains/${found.id}/recipients`),
      call<Alias[]>(`/domains/${found.id}/aliases`),
      call<QuotaPayload>(`/domains/${found.id}/quotas`),
    ]);
    recipients.value = recs;
    aliases.value = als;
    quota.value = quotaData.domain;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-3 min-w-0">
        <UIcon name="i-lucide-globe" class="text-primary shrink-0 text-xl" />
        <div class="min-w-0">
          <h2 class="text-lg font-semibold truncate">{{ domain?.domain ?? "..." }}</h2>
          <p class="text-xs text-muted">{{ t("domains.alertTitle") }}</p>
        </div>
        <UBadge v-if="domain" :color="domain.active ? 'success' : 'neutral'" variant="subtle">
          {{ domain.active ? t("common.active") : t("common.inactive") }}
        </UBadge>
      </div>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <UCard :ui="{ root: 'transition hover:shadow-lg' }">
        <NuxtLink to="/recipients" class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted">{{ t("nav.recipients") }}</p>
            <p class="text-3xl font-semibold mt-1">{{ recipients.length }}</p>
            <p class="text-xs text-muted mt-1">{{ t("dashboard.stats.activeCount", { count: activeRecipients }) }}</p>
          </div>
          <div class="rounded-lg p-2 bg-elevated">
            <UIcon name="i-lucide-users" class="text-2xl text-info" />
          </div>
        </NuxtLink>
      </UCard>

      <UCard :ui="{ root: 'transition hover:shadow-lg' }">
        <NuxtLink to="/aliases" class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted">{{ t("nav.aliases") }}</p>
            <p class="text-3xl font-semibold mt-1">{{ aliases.length }}</p>
            <p class="text-xs text-muted mt-1">{{ t("dashboard.stats.forwarders") }}</p>
          </div>
          <div class="rounded-lg p-2 bg-elevated">
            <UIcon name="i-lucide-at-sign" class="text-2xl text-success" />
          </div>
        </NuxtLink>
      </UCard>

      <UCard :ui="{ root: 'transition hover:shadow-lg' }">
        <NuxtLink to="/quotas" class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted">{{ t("nav.quotas") }}</p>
            <p class="text-3xl font-semibold mt-1">{{ usedGb }}</p>
            <p class="text-xs text-muted mt-1">{{ t("domains.capacity.hint").split("(")[0].trim() }} {{ quotaGb }}</p>
          </div>
          <div class="rounded-lg p-2 bg-elevated">
            <UIcon name="i-lucide-bar-chart-3" class="text-2xl text-primary" />
          </div>
        </NuxtLink>
      </UCard>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <UCard :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }" @click="navigateTo('/recipients')">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-users" class="text-info text-xl" />
          <span class="font-medium">{{ t("nav.recipients") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>

      <UCard :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }" @click="navigateTo('/aliases')">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-at-sign" class="text-success text-xl" />
          <span class="font-medium">{{ t("nav.aliases") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>

      <UCard :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }" @click="navigateTo('/quotas')">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-bar-chart-3" class="text-primary text-xl" />
          <span class="font-medium">{{ t("nav.quotas") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>
    </div>
  </div>
</template>
