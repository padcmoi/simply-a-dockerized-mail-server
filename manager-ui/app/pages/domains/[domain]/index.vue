<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "domain", action: "access" },
    { resource: "domain", action: "read" },
  ],
});

const {
  REFRESH_OPTIONS,
  domain,
  recipients,
  aliases,
  topMailboxes,
  dkimKeys,
  rspamdHistory,
  postfixQueue,
  loading,
  dkimLoading,
  postfixLoading,
  refreshInterval,
  activeRecipients,
  usedBytes,
  allocatedBytes,
  freeBytes,
  isUnlimited,
  messagesCount,
  diskChartData,
  diskChartOptions,
  barChartData,
  barChartOptions,
  barChartHeight,
  load,
  rotateDkim,
  deleteDkim,
  copyToClipboard,
} = useDomainDashboard();

const { isRoot, hasDomain } = usePermissions();

// Domain ownership transfer: restricted to root or the domain's current owner
// (mirrors the group owner-transfer control on the group detail page).
const auth = useAuthStore();
const { call } = useApi();
const toast = useToast();
const { t } = useI18n();

const ownerPick = ref<number | undefined>(undefined);
const savingOwner = ref(false);
const accountOptions = ref<{ label: string; value: number }[]>([]);
// Starts true: still don't know `domain.id` at first paint (SSR + pre-mount),
// so the select must show a skeleton immediately rather than an empty
// dropdown before we've even determined whether a fetch is needed.
const ownerOptionsLoading = ref(true);

// `rspamd`/`dkim` history sections below are scoped to the `spamd`/`dkim` domain
// resources specifically (not the generic `domain` gate this page's own route
// already requires) — only render them if the current user actually has access.
const canViewSpamd = computed(() => isRoot.value || (domain.value && hasDomain(domain.value.id, "spamd", "access")));
const canViewDkim = computed(() => isRoot.value || (domain.value && hasDomain(domain.value.id, "dkim", "access")));

const canTransferOwner = computed(
  () => isRoot.value || (domain.value?.ownerUsername != null && domain.value.ownerUsername === auth.session?.username)
);

const domainPath = computed(() => (domain.value ? `/domains/${domain.value.domain}` : null));

watch(
  () => domain.value?.id,
  async (id) => {
    if (id == null) return; // still don't know yet -- keep the skeleton up
    if (!canTransferOwner.value || accountOptions.value.length) {
      ownerOptionsLoading.value = false;
      return;
    }
    ownerOptionsLoading.value = true;
    try {
      const accounts = await call<{ id: number; username: string; name: string | null }[]>("/accounts/names").catch(() => []);
      accountOptions.value = accounts.map((a) => ({ label: a.name ? `${a.username} (${a.name})` : a.username, value: a.id }));
    } finally {
      ownerOptionsLoading.value = false;
    }
  },
  { immediate: true }
);

async function changeDomainOwner() {
  if (!domain.value || ownerPick.value === undefined) return;
  savingOwner.value = true;
  try {
    await call(`/domains/${domain.value.id}/owner`, { method: "PATCH", body: { newOwnerId: ownerPick.value } });
    await load();
    ownerPick.value = undefined;
    toast.add({ title: t("domainDashboard.owner.saved"), color: "success" });
  } catch (e) {
    toast.add({ title: t("domainDashboard.owner.saveFailed"), description: (e as Error).message, color: "error" });
  } finally {
    savingOwner.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-3 min-w-0">
        <UIcon name="i-lucide-globe" class="text-primary shrink-0 text-xl" />
        <template v-if="domain">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold truncate">
              {{ domain.domain }}
            </h2>
            <p class="text-xs text-muted">{{ $t("domains.alertTitle") }}</p>
          </div>
          <UBadge :color="domain.active ? 'success' : 'neutral'" variant="subtle">
            {{ domain.active ? $t("common.active") : $t("common.inactive") }}
          </UBadge>
        </template>
        <div v-else class="min-w-0 space-y-1.5">
          <USkeleton class="h-5 w-40" />
          <USkeleton class="h-3 w-56" />
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 text-xs text-muted">
          <span class="hidden sm:block shrink-0">{{ $t("domainDashboard.autoRefresh.label") }}:</span>
          <div class="flex gap-0.5">
            <button
              v-for="opt in REFRESH_OPTIONS"
              :key="opt"
              class="px-2 py-1 rounded text-xs font-medium transition-colors"
              :class="refreshInterval === opt ? 'bg-primary text-white' : 'bg-elevated text-muted hover:text-default'"
              @click="refreshInterval = opt"
            >
              {{ opt === 0 ? $t("domainDashboard.autoRefresh.off") : `${opt}s` }}
            </button>
          </div>
        </div>
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="loading" square @click="load" />
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

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ $t("domainDashboard.disk.title") }}</h2>
        </template>
        <div v-if="loading && !domain" class="flex flex-col sm:flex-row items-center gap-6">
          <USkeleton class="shrink-0 w-36 h-36 rounded-full" />
          <div class="space-y-2 w-full">
            <USkeleton v-for="i in 3" :key="i" class="h-4 w-full" />
          </div>
        </div>
        <div v-else class="flex flex-col sm:flex-row items-center gap-6">
          <div class="relative shrink-0 w-36 h-36">
            <ChartsDoughnutChart :data="diskChartData" :options="diskChartOptions" />
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
                <span class="w-3 h-3 rounded-sm bg-success shrink-0" />
                <span class="text-muted">{{ $t("domainDashboard.disk.free") }}</span>
                <span class="font-medium ml-auto pl-4">{{ formatBytes(freeBytes) }}</span>
              </li>
              <li class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-sm bg-primary shrink-0" />
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
            {{ $t("domainDashboard.topMailboxes.title") }}
          </h2>
        </template>
        <div v-if="loading && !domain" class="space-y-2 py-2">
          <USkeleton v-for="i in 5" :key="i" class="h-6 w-full" />
        </div>
        <p v-else-if="topMailboxes.length === 0" class="text-sm text-muted text-center py-4">
          {{ $t("domainDashboard.topMailboxes.noData") }}
        </p>
        <ChartsBarChart v-else :data="barChartData" :options="barChartOptions" :height="barChartHeight" />
      </UCard>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <DomainRspamdCard v-if="canViewSpamd" :history="rspamdHistory" :loading="loading" />
      <DomainPostfixCard :queue="postfixQueue" :loading="postfixLoading" />
    </div>

    <DomainDkimSection
      v-if="canViewDkim"
      :keys="dkimKeys"
      :loading="dkimLoading"
      @rotate="rotateDkim"
      @delete="deleteDkim"
      @copy="copyToClipboard"
    />

    <UCard v-if="canTransferOwner">
      <template #header>
        <h3 class="font-semibold">{{ $t("domainDashboard.owner.title") }}</h3>
      </template>
      <p class="text-sm mb-3">
        {{ domain?.ownerUsername ?? $t("domainDashboard.owner.unassigned") }}
      </p>
      <div class="flex flex-wrap gap-2">
        <USkeleton v-if="ownerOptionsLoading" class="h-8 w-48 rounded-md" />
        <USelectMenu
          v-else
          v-model="ownerPick"
          value-key="value"
          :items="accountOptions"
          :placeholder="$t('domainDashboard.owner.pickPlaceholder')"
          class="min-w-[12rem]"
        />
        <UButton
          color="neutral"
          variant="outline"
          :loading="savingOwner"
          :disabled="ownerPick === undefined"
          @click="changeDomainOwner"
        >
          {{ $t("domainDashboard.owner.change") }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>
