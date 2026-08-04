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

const hasLoadedOnce = ref(false);

const failed = computed(() => status.value === "error");
const loading = computed(() => status.value === "pending");
const domains = computed(() => data.value?.domains ?? []);
const recipients = computed(() => data.value?.recipients ?? []);
const aliases = computed(() => data.value?.aliases ?? []);

watch(
  status,
  (s) => {
    if (s === "success" || s === "error") hasLoadedOnce.value = true;
  },
  { immediate: true }
);
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
          <UBadge v-if="hasLoadedOnce" color="neutral" variant="subtle">{{ domains.length }}</UBadge>
        </div>
      </template>

      <div v-if="!hasLoadedOnce" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

    <OwnedRecipientsTable :recipients="recipients" :loading="loading" :has-loaded-once="hasLoadedOnce" />
    <OwnedAliasesTable :aliases="aliases" :loading="loading" :has-loaded-once="hasLoadedOnce" />
  </div>
</template>
