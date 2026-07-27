<script setup lang="ts">
definePageMeta({ requiredGlobal: [{ resource: "domains", action: "access" }] });

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
  lastActivity?: string;
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
interface DiskInfo {
  totalBytes: number;
  freeBytes: number;
  reservedBytes: number;
  assignableBytes: number;
}

const { set: setBreadcrumb } = useBreadcrumb();
const { t } = useI18n();
const { call } = useApi();
const { tick } = useDataRefresh();

setBreadcrumb([{ label: t("nav.administration") }]);

interface DashboardData {
  domains: Domain[];
  recipients: Recipient[];
  aliases: Alias[];
  rejects: Reject[];
  disk: DiskInfo | null;
}

// The server-computed overview (SQL aggregates + disk), pushed over WS to
// anyone allowed to see every domain. It carries counts and the small
// recent/per-domain lists rather than the raw ~thousands of rows the REST
// fallback below fans out for -- lighter, and the single source of truth when
// present.
interface DashboardSummary {
  domains: { total: number; active: number };
  recipients: { total: number; active: number };
  aliases: { total: number };
  blockedSenders: { total: number; enabled: number };
  disk: DiskInfo | null;
  recipientsPerDomain: { domain: string; count: number }[];
  recentDomains: { id: number; domain: string; quota: string; active: number }[];
  recentRecipients: { id: number; email: string; domain: string; active: number }[];
}

const summary = useRealtimeTopic<DashboardSummary>("dashboard");

const { data, status } = useAsyncData<DashboardData>(
  "dashboard-main",
  async () => {
    const [domainList, rejectList, diskData] = await Promise.all([
      call<Domain[]>("/domains").catch(() => [] as Domain[]),
      call<Reject[]>("/sieve/reject-senders").catch(() => [] as Reject[]),
      call<DiskInfo>("/domains/disk").catch(() => null),
    ]);

    const [recs, als] = await Promise.all([
      Promise.all(domainList.map((d) => call<Recipient[]>(`/domains/${d.id}/recipients`).catch(() => [] as Recipient[]))),
      Promise.all(domainList.map((d) => call<Alias[]>(`/domains/${d.id}/aliases`).catch(() => [] as Alias[]))),
    ]);

    return { domains: domainList, recipients: recs.flat(), aliases: als.flat(), rejects: rejectList, disk: diskData };
  },
  {
    server: false,
    watch: [tick],
    default: () => ({ domains: [], recipients: [], aliases: [], rejects: [], disk: null }),
  }
);

// Same shape as the WS summary, rebuilt from the REST fan-out, so the template
// reads one `view` object regardless of source (WS when available, REST else).
const restSummary = computed<DashboardSummary>(() => {
  const domains = data.value?.domains ?? [];
  const recipients = data.value?.recipients ?? [];
  return {
    domains: { total: domains.length, active: domains.filter((d) => d.active).length },
    recipients: { total: recipients.length, active: recipients.filter((r) => r.active).length },
    aliases: { total: (data.value?.aliases ?? []).length },
    blockedSenders: {
      total: (data.value?.rejects ?? []).length,
      enabled: (data.value?.rejects ?? []).filter((r) => r.enabled).length,
    },
    disk: data.value?.disk ?? null,
    recipientsPerDomain: domains
      .map((d) => ({ domain: d.domain, count: recipients.filter((r) => r.domain === d.domain).length }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    recentDomains: [...domains]
      .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))
      .slice(0, 5)
      .map((d) => ({ id: d.id, domain: d.domain, quota: d.quota, active: d.active })),
    recentRecipients: [...recipients]
      .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))
      .slice(0, 6)
      .map((r) => ({ id: r.id, email: r.email, domain: r.domain, active: r.active })),
  };
});

const view = computed(() => summary.value ?? restSummary.value);
const disk = computed(() => view.value.disk);
const loading = computed(() => !summary.value && status.value !== "success" && status.value !== "error");

const stats = computed(() => [
  {
    key: "domains",
    label: t("dashboard.stats.domains"),
    value: view.value.domains.total,
    sub: t("dashboard.stats.activeCount", { count: view.value.domains.active }),
    icon: "i-lucide-globe",
    color: "primary",
    to: "/admin/domains",
  },
  {
    key: "recipients",
    label: t("dashboard.stats.recipients"),
    value: view.value.recipients.total,
    sub: t("dashboard.stats.activeCount", { count: view.value.recipients.active }),
    icon: "i-lucide-users",
    color: "info",
    // Aggregated across every domain -- no single nested route to point at,
    // so this (like the "aliases" stat below) links to the domain picker
    // instead of a specific /domains/:domain/recipients.
    to: "/admin/domains",
  },
  {
    key: "aliases",
    label: t("dashboard.stats.aliases"),
    value: view.value.aliases.total,
    sub: t("dashboard.stats.forwarders"),
    icon: "i-lucide-at-sign",
    color: "success",
    to: "/admin/domains",
  },
  {
    key: "rejects",
    label: t("dashboard.stats.blockedSenders"),
    value: view.value.blockedSenders.total,
    sub: t("dashboard.stats.enabledCount", { count: view.value.blockedSenders.enabled }),
    icon: "i-lucide-shield-x",
    color: "warning",
    to: "/admin/sieve",
  },
]);

const recentDomains = computed(() => view.value.recentDomains);
const recentRecipients = computed(() => view.value.recentRecipients);
const recipientsPerDomain = computed(() => view.value.recipientsPerDomain);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-layout-dashboard" :title="t('dashboard.subtitle')" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <DomainStatCard
        v-for="stat in stats"
        :key="stat.key"
        :label="stat.label"
        :value="stat.value"
        :sub="stat.sub"
        :icon="stat.icon"
        icon-color="text-primary"
        :loading="loading && !disk"
        :to="stat.to"
      />
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("dashboard.disk.title") }}</h2>
        </template>
        <USkeleton v-if="loading && !disk" class="h-36 w-36 rounded-full mx-auto" />
        <DiskDonutChart
          v-else-if="disk"
          :total-bytes="disk.totalBytes"
          :free-bytes="disk.freeBytes"
          :reserved-bytes="disk.reservedBytes"
        />
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ t("dashboard.chart.recipientsPerDomain") }}
          </h2>
        </template>
        <div v-if="loading && !disk" class="space-y-2 py-2">
          <USkeleton v-for="i in 5" :key="i" class="h-6 w-full" />
        </div>
        <DomainBarChart v-else :items="recipientsPerDomain" />
      </UCard>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">{{ t("dashboard.recent.domains") }}</h2>
            <UButton to="/admin/domains" variant="link" size="xs" trailing-icon="i-lucide-arrow-right">
              {{ t("common.viewAll") }}
            </UButton>
          </div>
        </template>
        <div v-if="loading && !disk" class="space-y-3 py-1">
          <USkeleton v-for="i in 5" :key="i" class="h-10 w-full" />
        </div>
        <UEmptyState
          v-else-if="recentDomains.length === 0"
          icon="i-lucide-globe"
          :title="t('dashboard.recent.noDomains')"
          :description="t('dashboard.recent.noDomainsHint')"
        >
          <template #actions>
            <UButton to="/admin/domains" icon="i-lucide-plus" color="primary">
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
              <p class="text-xs text-muted">
                {{ t("dashboard.recent.quotaLabel", { value: d.quota }) }}
              </p>
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
            <h2 class="font-semibold">
              {{ t("dashboard.recent.recipients") }}
            </h2>
            <UButton to="/admin/domains" variant="link" size="xs" trailing-icon="i-lucide-arrow-right">
              {{ t("common.viewAll") }}
            </UButton>
          </div>
        </template>
        <div v-if="loading && !disk" class="space-y-3 py-1">
          <USkeleton v-for="i in 6" :key="i" class="h-10 w-full" />
        </div>
        <UEmptyState
          v-else-if="recentRecipients.length === 0"
          icon="i-lucide-users"
          :title="t('dashboard.recent.noRecipients')"
          :description="t('dashboard.recent.noRecipientsHint')"
        >
          <template #actions>
            <UButton to="/admin/domains" icon="i-lucide-plus" color="primary">
              {{ t("dashboard.recent.addRecipient") }}
            </UButton>
          </template>
        </UEmptyState>
        <ul v-else class="divide-y divide-default">
          <li
            v-for="r in recentRecipients"
            :key="r.id"
            class="py-3 flex items-center gap-3 cursor-pointer hover:bg-elevated/50 transition-colors rounded-md px-1 -mx-1"
            @click="navigateTo(`/admin/domains/${r.domain}/recipients`)"
          >
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
