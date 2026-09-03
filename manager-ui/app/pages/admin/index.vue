<script setup lang="ts">
definePageMeta({ requiredGlobal: [{ resource: "domains", action: "access" }] });

const { set: setBreadcrumb } = useBreadcrumb();
const { t } = useI18n();

setBreadcrumb([{ label: t("nav.administration") }]);

const { stats, disk, loading, recentDomains, recentRecipients, recipientsPerDomain } = useAdminDashboard();
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
                {{ t("dashboard.recent.quotaLabel", { value: formatBytes(Number(d.quota)) }) }}
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
              <p class="text-xs text-muted truncate">{{ r.domain }}</p>
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
