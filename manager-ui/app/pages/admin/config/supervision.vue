<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.supervision.cardTitle") }]);

const { saving, loaded, days, valid, rows, load, save, resetDefaults } = useSupervisionRetention();
await useAsyncData("supervision-retention", () => load(), { server: false });
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-database"
      color="neutral"
      variant="subtle"
      :title="t('config.supervision.alertTitle')"
      :description="t('config.supervision.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/config" size="sm">
      {{ t("config.backToConfig") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("config.supervision.cardTitle") }}</h2>
      </template>

      <div v-if="!loaded" class="space-y-4">
        <USkeleton class="h-12 w-full" />
      </div>

      <div v-else class="space-y-6">
        <UFormField
          :label="t('config.supervision.retention')"
          name="retention"
          :description="t('config.supervision.retentionHint')"
        >
          <UInput v-model.number="days" type="number" :min="1" :max="365" class="w-full sm:w-48" />
        </UFormField>

        <p class="text-sm text-muted">{{ t("config.supervision.rowsEstimate", { rows: rows.toLocaleString() }) }}</p>

        <div class="flex justify-end gap-2">
          <UButton icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="resetDefaults">
            {{ t("config.supervision.reset") }}
          </UButton>
          <UButton icon="i-lucide-check" color="primary" :loading="saving" :disabled="!valid" @click="save">
            {{ t("config.supervision.save") }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
