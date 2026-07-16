<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "domain", action: "access" },
    { resource: "domain", action: "view-domain" },
  ],
});

const {
  domain,
  recipients,
  aliases,
  topMailboxes,
  dkimCheck,
  rspamdHistory,
  postfixQueue,
  loading,
  dkimLoading,
  postfixLoading,
  activeRecipients,
  usedBytes,
  allocatedBytes,
  reservedBytes,
  assignableBytes,
  isUnlimited,
  messagesCount,
  diskChartData,
  diskChartOptions,
  barChartData,
  barChartOptions,
  barChartHeight,
} = useDomainDashboard();

const { isRoot, hasDomain } = usePermissions();

// `rspamd` section below is scoped to the `rspamd` domain resource specifically
// (not the generic `domain` gate this page's own route already requires);
// only render it if the current user actually has both access+read, matching
// the dedicated /rspamd page's own requiredDomain gate and the API guard.
// DKIM key material and domain ownership are sensitive, kept off this
// dashboard entirely (see the dedicated `/app` page, gated by the "admin"
// domain resource) -- `canViewAdmin` here only gates whether the status
// indicator + link to that page show up.
const canViewRspamd = computed(
  () =>
    isRoot.value ||
    (domain.value && hasDomain(domain.value.id, "rspamd", "access") && hasDomain(domain.value.id, "rspamd", "view-rspamd-stats"))
);
const canViewAdmin = computed(() => isRoot.value || (domain.value && hasDomain(domain.value.id, "admin", "access")));

const domainPath = computed(() => (domain.value ? `/domains/${domain.value.domain}` : null));

const { t } = useI18n();

// Reflects the actual DNS TXT match (dkimCheck), not just whether a key row
// exists in the DB -- a stale/never-updated DNS record must show as "not ok"
// here, not as "generated".
const dkimStatusOk = computed(() => dkimCheck.value?.hasKeyInDatabase === true && dkimCheck.value.match === true);
const dkimStatusIcon = computed(() => (dkimStatusOk.value ? "i-lucide-shield-check" : "i-lucide-shield-x"));
const dkimStatusColor = computed(() => (dkimStatusOk.value ? "text-success" : "text-error"));
const dkimStatusText = computed(() => {
  if (!dkimCheck.value || !dkimCheck.value.hasKeyInDatabase) return t("domainDashboard.dkim.statusMissing");
  return dkimCheck.value.match ? t("domainDashboard.dkim.statusMatch") : t("domainDashboard.dkim.statusMismatch");
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <div class="flex items-center gap-3 min-w-0 flex-wrap">
      <UIcon name="i-lucide-globe" class="text-primary shrink-0 text-xl" />
      <template v-if="domain">
        <div class="min-w-0">
          <h2 class="text-lg font-semibold truncate">
            {{ domain.domain }}
          </h2>
          <p class="text-xs text-muted">{{ $t("domains.alertTitle") }}</p>
        </div>

        <UBadge :color="domain.active ? 'success' : 'warning'" variant="subtle">
          {{ domain.active ? $t("common.active") : $t("common.inactive") }}
        </UBadge>

        <UTooltip v-if="canViewAdmin && dkimCheck" :text="dkimStatusText">
          <UBadge :color="dkimStatusOk ? 'success' : 'error'" variant="subtle" :icon="dkimStatusIcon"> DKIM </UBadge>
        </UTooltip>
      </template>
      <div v-else class="min-w-0 space-y-1.5">
        <USkeleton class="h-5 w-40" />
        <USkeleton class="h-3 w-56" />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <DomainStatCard
        :label="$t('nav.recipients')"
        :value="recipients.length"
        :sub="$t('dashboard.stats.activeCount', { count: activeRecipients })"
        icon="i-lucide-users"
        icon-color="text-info"
        :loading="loading && !domain"
        :to="domainPath ? `${domainPath}/recipients` : undefined"
      />
      <DomainStatCard
        :label="$t('nav.aliases')"
        :value="aliases.length"
        :sub="$t('dashboard.stats.forwarders')"
        icon="i-lucide-at-sign"
        icon-color="text-success"
        :loading="loading && !domain"
        :to="domainPath ? `${domainPath}/aliases` : undefined"
      />
      <DomainStatCard
        :label="$t('domainDashboard.messages')"
        :value="messagesCount"
        :sub="$t('domainDashboard.activity')"
        icon="i-lucide-mail"
        icon-color="text-warning"
        :loading="loading && !domain"
      />
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ $t("domainDashboard.disk.title") }}</h2>
        </template>
        <div v-if="loading && !domain" class="flex flex-col sm:flex-row items-center gap-6">
          <USkeleton class="shrink-0 w-36 h-36 rounded-full" />
          <div class="space-y-2 w-full">
            <USkeleton v-for="i in 4" :key="i" class="h-4 w-full" />
          </div>
        </div>
        <div v-else class="flex flex-col sm:flex-row items-center gap-6">
          <div class="relative shrink-0 w-36 h-36">
            <DoughnutChart :data="diskChartData" :options="diskChartOptions" />
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span class="text-xs text-muted font-medium">{{ formatBytes(usedBytes) }}</span>
              <span v-if="!isUnlimited" class="text-[10px] text-dimmed">/ {{ formatBytes(allocatedBytes) }}</span>
              <span v-else class="text-[10px] text-dimmed">{{ $t("domainDashboard.disk.unlimited") }}</span>
            </div>
          </div>
          <ul class="space-y-2 text-sm min-w-0">
            <li class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-sm bg-error shrink-0" />
              <span class="text-muted">{{ $t("domainDashboard.disk.used") }}</span>
              <span class="font-medium ml-auto pl-4">{{ formatBytes(usedBytes) }}</span>
            </li>
            <template v-if="!isUnlimited">
              <li class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-sm bg-warning shrink-0" />
                <span class="text-muted">{{ $t("domainDashboard.disk.reserved") }}</span>
                <span class="font-medium ml-auto pl-4">{{ formatBytes(reservedBytes) }}</span>
              </li>
              <li class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-sm bg-success shrink-0" />
                <span class="text-muted">{{ $t("domainDashboard.disk.assignable") }}</span>
                <span class="font-medium ml-auto pl-4">{{ formatBytes(assignableBytes) }}</span>
              </li>
              <li class="flex items-center gap-2 border-t border-default pt-2">
                <span class="w-3 h-3 shrink-0" />
                <span class="text-muted">{{ $t("domainDashboard.disk.allocated") }}</span>
                <span class="font-medium ml-auto pl-4">{{ formatBytes(allocatedBytes) }}</span>
              </li>
            </template>
            <li v-else>
              <UBadge color="primary" variant="subtle">{{ $t("domainDashboard.disk.unlimited") }}</UBadge>
            </li>
          </ul>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            {{ $t("domainDashboard.topMailboxes.title", { count: TOP_MAILBOXES }) }}
          </h2>
        </template>
        <div v-if="loading && !domain" class="space-y-2 py-2">
          <USkeleton v-for="i in 5" :key="i" class="h-6 w-full" />
        </div>
        <p v-else-if="topMailboxes.length === 0" class="text-sm text-muted text-center py-4">
          {{ $t("domainDashboard.topMailboxes.noData") }}
        </p>
        <BarChart v-else :data="barChartData" :options="barChartOptions" :height="barChartHeight" />
      </UCard>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <UCard
        :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
        @click="domainPath && navigateTo(`${domainPath}/recipients`)"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-users" class="text-info text-xl" />
          <span class="font-medium">{{ $t("nav.recipients") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>
      <UCard
        :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
        @click="domainPath && navigateTo(`${domainPath}/aliases`)"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-at-sign" class="text-success text-xl" />
          <span class="font-medium">{{ $t("nav.aliases") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>
      <UCard
        :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
        @click="domainPath && navigateTo(`${domainPath}/quotas`)"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-bar-chart-3" class="text-primary text-xl" />
          <span class="font-medium">{{ $t("nav.quotas") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>
      <UCard
        v-if="canViewAdmin"
        :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }"
        @click="domainPath && navigateTo(`${domainPath}/app`)"
      >
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-shield-alert" class="text-warning text-xl" />
          <span class="font-medium">{{ $t("nav.admin") }}</span>
          <UIcon v-if="dkimLoading" name="i-lucide-loader-2" class="ml-auto text-muted animate-spin" />
          <UTooltip v-else :text="dkimStatusText" class="ml-auto">
            <UIcon :name="dkimStatusIcon" :class="dkimStatusColor" />
          </UTooltip>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <DomainRspamdCard v-if="canViewRspamd" :history="rspamdHistory" :loading="loading" />
      <DomainPostfixCard :queue="postfixQueue" :loading="postfixLoading" />
    </div>
  </div>
</template>
