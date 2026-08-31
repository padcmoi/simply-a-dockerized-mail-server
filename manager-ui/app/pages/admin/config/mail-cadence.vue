<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.cadence.cardTitle") }]);

const { saving, loaded, form, spoolError, sweepError, valid, load, save, resetDefaults } = useMailCadence();
await useAsyncData("mail-cadence", () => load(), { server: false });
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-timer"
      color="neutral"
      variant="subtle"
      :title="t('config.cadence.alertTitle')"
      :description="t('config.cadence.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/config" size="sm">
      {{ t("config.backToConfig") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("config.cadence.cardTitle") }}</h2>
      </template>

      <div v-if="!loaded" class="space-y-4">
        <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <div v-else class="space-y-6">
        <UFormField
          :label="t('config.cadence.offlineNotify')"
          name="offlineNotify"
          :description="t('config.cadence.offlineNotifyHint')"
        >
          <UInput v-model.number="form.offlineNotifyAfterS" type="number" :min="10" :max="86400" class="w-full sm:w-48" />
        </UFormField>

        <UFormField
          :label="t('config.cadence.sweep')"
          name="sweep"
          :description="t('config.cadence.sweepHint')"
          :error="sweepError"
        >
          <UInput v-model.number="form.offlineSweepIntervalS" type="number" :min="5" :max="3600" class="w-full sm:w-48" />
        </UFormField>

        <UFormField
          :label="t('config.cadence.spool')"
          name="spool"
          :description="t('config.cadence.spoolHint')"
          :error="spoolError"
        >
          <UInput v-model.number="form.mailMinIntervalS" type="number" :min="0" :max="3600" class="w-full sm:w-48" />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="resetDefaults">
            {{ t("config.cadence.reset") }}
          </UButton>
          <UButton icon="i-lucide-check" color="primary" :loading="saving" :disabled="!valid" @click="save">
            {{ t("config.cadence.save") }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
