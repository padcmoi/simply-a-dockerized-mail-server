<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "supervision", action: "access" },
    { resource: "supervision", action: "view-machine-metrics" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.supervision") }]);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-activity" :title="t('supervision.subtitle')" />

    <SystemPanel />
  </div>
</template>
