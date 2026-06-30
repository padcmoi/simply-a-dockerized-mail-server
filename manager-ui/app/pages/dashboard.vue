<script setup lang="ts">
definePageMeta({});

interface Domain {
  id: number;
  domain: string;
  quota: string;
  active: number;
  lastActivity?: string;
}
interface Recipient {
  id: number;
  email: string;
  domain: string;
  active: number;
}
interface Alias {
  id: number;
  source: string;
  destination: string;
  domain: string;
}
interface Reject {
  id: number;
  sender: string;
  enabled: number;
}

const loading = ref(false);
const domains = ref<Domain[]>([]);
const recipients = ref<Recipient[]>([]);
const aliases = ref<Alias[]>([]);
const rejects = ref<Reject[]>([]);

const stats = computed(() => [
  {
    key: "domains",
    label: t("dashboard.stats.domains"),
    value: domains.value.length,
    sub: t("dashboard.stats.activeCount", { count: domains.value.filter((d) => d.active).length }),
    icon: "i-lucide-globe",
    color: "primary",
    to: "/domains",
  },
  {
    key: "recipients",
    label: t("dashboard.stats.recipients"),
    value: recipients.value.length,
    sub: t("dashboard.stats.activeCount", { count: recipients.value.filter((r) => r.active).length }),
    icon: "i-lucide-users",
    color: "info",
    to: "/recipients",
  },
  {
    key: "aliases",
    label: t("dashboard.stats.aliases"),
    value: aliases.value.length,
    sub: t("dashboard.stats.forwarders"),
    icon: "i-lucide-at-sign",
    color: "success",
    to: "/aliases",
  },
  {
    key: "rejects",
    label: t("dashboard.stats.blockedSenders"),
    value: rejects.value.length,
    sub: t("dashboard.stats.enabledCount", { count: rejects.value.filter((r) => r.enabled).length }),
    icon: "i-lucide-shield-x",
    color: "warning",
    to: "/sieve",
  },
]);
const recentDomains = computed(() => domains.value.slice(0, 5));
const recentRecipients = computed(() => recipients.value.slice(0, 6));

const { t } = useI18n();
const { call } = useApi();

async function load() {
  loading.value = true;
  try {
    domains.value = await call<Domain[]>("/domains");
    const recs = await Promise.all(domains.value.map((d) => call<Recipient[]>(`/domains/${d.id}/recipients`)));
    recipients.value = recs.flat();
    const als = await Promise.all(domains.value.map((d) => call<Alias[]>(`/domains/${d.id}/aliases`)));
    aliases.value = als.flat();
    rejects.value = await call<Reject[]>("/sieve/reject-senders");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm text-muted">{{ t("dashboard.subtitle") }}</p>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <UCard v-for="stat in stats" :key="stat.key" :ui="{ root: 'transition hover:shadow-lg' }">
        <NuxtLink :to="stat.to" class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted">{{ stat.label }}</p>
            <p class="text-3xl font-semibold mt-1">{{ stat.value }}</p>
            <p class="text-xs text-muted mt-1">{{ stat.sub }}</p>
          </div>
          <div class="rounded-lg p-2 bg-elevated">
            <UIcon :name="stat.icon" class="text-2xl text-primary" />
          </div>
        </NuxtLink>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">{{ t("dashboard.recent.domains") }}</h2>
            <UButton to="/domains" variant="link" size="xs" trailing-icon="i-lucide-arrow-right">
              {{ t("common.viewAll") }}
            </UButton>
          </div>
        </template>
        <UEmptyState
          v-if="!loading && recentDomains.length === 0"
          icon="i-lucide-globe"
          :title="t('dashboard.recent.noDomains')"
          :description="t('dashboard.recent.noDomainsHint')"
        >
          <template #actions>
            <UButton to="/domains" icon="i-lucide-plus" color="primary">
              {{ t("dashboard.recent.addDomain") }}
            </UButton>
          </template>
        </UEmptyState>
        <ul v-else class="divide-y divide-default">
          <li v-for="d in recentDomains" :key="d.id" class="py-3 flex items-center gap-3">
            <div class="rounded-md p-2 bg-elevated shrink-0">
              <UIcon name="i-lucide-globe" class="text-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ d.domain }}</p>
              <p class="text-xs text-muted">{{ t("dashboard.recent.quotaLabel", { value: d.quota }) }}</p>
            </div>
            <UBadge :color="d.active ? 'success' : 'neutral'" variant="subtle">
              {{ d.active ? t("common.active") : t("common.inactive") }}
            </UBadge>
          </li>
        </ul>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">{{ t("dashboard.recent.recipients") }}</h2>
            <UButton to="/recipients" variant="link" size="xs" trailing-icon="i-lucide-arrow-right">
              {{ t("common.viewAll") }}
            </UButton>
          </div>
        </template>
        <UEmptyState
          v-if="!loading && recentRecipients.length === 0"
          icon="i-lucide-users"
          :title="t('dashboard.recent.noRecipients')"
          :description="t('dashboard.recent.noRecipientsHint')"
        >
          <template #actions>
            <UButton to="/recipients" icon="i-lucide-plus" color="primary">
              {{ t("dashboard.recent.addRecipient") }}
            </UButton>
          </template>
        </UEmptyState>
        <ul v-else class="divide-y divide-default">
          <li v-for="r in recentRecipients" :key="r.id" class="py-3 flex items-center gap-3">
            <UAvatar :alt="r.email" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ r.email }}</p>
              <p class="text-xs text-muted">{{ r.domain }}</p>
            </div>
            <UBadge :color="r.active ? 'success' : 'neutral'" variant="subtle">
              {{ r.active ? t("common.active") : t("common.inactive") }}
            </UBadge>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
