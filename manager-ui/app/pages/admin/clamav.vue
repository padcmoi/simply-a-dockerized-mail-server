<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "clamav", action: "access" },
    { resource: "clamav", action: "view-clamav-status" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.clamav") }]);

const { status, loading, failed } = useClamav();
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-bug" :title="t('clamav.title')" :description="t('clamav.subtitle')" />

    <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('clamav.loadFailed')" />

    <!-- The shape of what is coming rather than a row of dashes: nothing here
         can be told apart from a scanner that answered zero. -->
    <template v-else-if="loading || !status">
      <UCard>
        <div class="space-y-4">
          <USkeleton class="h-4 w-40" />
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <USkeleton v-for="figure in 4" :key="figure" class="h-12 w-full" />
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="space-y-3">
          <USkeleton v-for="row in 4" :key="row" class="h-8 w-full" />
        </div>
      </UCard>
    </template>

    <template v-else>
      <ClamavEngineCard :status="status" />
      <ClamavDatabasesCard :databases="status.databases" />
    </template>
  </div>
</template>
