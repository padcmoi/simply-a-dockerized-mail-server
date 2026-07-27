<script setup lang="ts">
definePageMeta({});

interface OwnedDomain {
  id: number;
  domain: string;
  active: boolean;
  quota: string;
}
interface OwnedRecipient {
  id: number;
  email: string;
  domain: string;
  active: boolean;
  quota: string;
}
interface OwnedAlias {
  id: number;
  source: string;
  destination: string;
  domain: string;
}
interface Overview {
  domains: OwnedDomain[];
  recipients: OwnedRecipient[];
  aliases: OwnedAlias[];
}

const { t } = useI18n();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();
const { tick } = useDataRefresh();

setBreadcrumb([{ label: t("nav.myspace") }]);

const { data, status } = useAsyncData<Overview>("myspace-overview", () => call<Overview>("/auth/jwt/me/overview"), {
  server: false,
  watch: [tick],
  default: () => ({ domains: [], recipients: [], aliases: [] }),
});

const loading = computed(() => status.value !== "success" && status.value !== "error");
const failed = computed(() => status.value === "error");
const domains = computed(() => data.value?.domains ?? []);
const recipients = computed(() => data.value?.recipients ?? []);
const aliases = computed(() => data.value?.aliases ?? []);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-house"
      :title="t('myspace.alertTitle')"
      :description="t('myspace.alertDescription')"
    />

    <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('myspace.loadFailed')" />

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <h2 class="font-semibold">{{ t("myspace.ownedDomains") }}</h2>
          <UBadge v-if="!loading" color="neutral" variant="subtle">{{ domains.length }}</UBadge>
        </div>
      </template>

      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <USkeleton v-for="i in 3" :key="i" class="h-16 w-full" />
      </div>
      <UEmptyState v-else-if="domains.length === 0" icon="i-lucide-globe" :title="t('myspace.noDomains')" />
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="d in domains" :key="d.id" class="flex items-center gap-3 rounded-md border border-default p-3 min-w-0">
          <div class="rounded-md p-2 bg-elevated shrink-0">
            <UIcon name="i-lucide-globe" class="text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ d.domain }}</p>
            <p class="text-xs text-muted truncate">{{ t("myspace.quotaLabel", { value: d.quota }) }}</p>
          </div>
          <UBadge :color="d.active ? 'success' : 'neutral'" variant="subtle">
            {{ d.active ? t("common.active") : t("common.inactive") }}
          </UBadge>
        </div>
      </div>
    </UCard>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="font-semibold">{{ t("myspace.ownedRecipients") }}</h2>
            <UBadge v-if="!loading" color="neutral" variant="subtle">{{ recipients.length }}</UBadge>
          </div>
        </template>

        <div v-if="loading" class="space-y-3 py-1">
          <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
        </div>
        <UEmptyState v-else-if="recipients.length === 0" icon="i-lucide-users" :title="t('myspace.noRecipients')" />
        <ul v-else class="divide-y divide-default">
          <li v-for="r in recipients" :key="r.id" class="py-3 flex items-center gap-3">
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

      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="font-semibold">{{ t("myspace.ownedAliases") }}</h2>
            <UBadge v-if="!loading" color="neutral" variant="subtle">{{ aliases.length }}</UBadge>
          </div>
        </template>

        <div v-if="loading" class="space-y-3 py-1">
          <USkeleton v-for="i in 4" :key="i" class="h-10 w-full" />
        </div>
        <UEmptyState v-else-if="aliases.length === 0" icon="i-lucide-at-sign" :title="t('myspace.noAliases')" />
        <ul v-else class="divide-y divide-default">
          <li v-for="a in aliases" :key="a.id" class="py-3 flex items-center gap-3">
            <div class="rounded-md p-2 bg-elevated shrink-0">
              <UIcon name="i-lucide-at-sign" class="text-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ a.source }}</p>
              <p class="text-xs text-muted truncate flex items-center gap-1">
                <UIcon name="i-lucide-arrow-right" class="shrink-0 size-3" />
                <span class="truncate">{{ a.destination }}</span>
              </p>
            </div>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
