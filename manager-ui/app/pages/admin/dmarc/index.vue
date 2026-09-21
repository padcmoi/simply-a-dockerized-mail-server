<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "dmarc", action: "access" },
    { resource: "dmarc", action: "view-dmarc-reports" },
  ],
});

const { t } = useI18n();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.dmarc") }]);

const {
  data: overview,
  status,
  refresh,
} = useAsyncData("dmarc-overview", () => call<DmarcOverview>("/dmarc/overview"), {
  server: false,
  watch: [useDataRefresh().tick],
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-mail-search"
      :title="t('dmarc.title')"
      :description="t('dmarc.subtitle')"
    />

    <DmarcSections active="overview" />

    <UAlert
      v-if="status === 'error'"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('dmarc.loadFailed')"
    />

    <div v-else-if="!overview" class="space-y-4">
      <div class="flex flex-wrap gap-4">
        <USkeleton v-for="tile in 6" :key="tile" class="h-24 grow basis-64" />
      </div>
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <template v-else>
      <DmarcOverviewStats :overview="overview" @changed="refresh" />
      <DmarcDomainsCard :domains="overview.domains" />
    </template>
  </div>
</template>
