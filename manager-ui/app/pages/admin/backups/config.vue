<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.backups"), to: "/admin/backups" }, { label: t("backups.config.title") }]);

const {
  saving,
  loaded,
  overview,
  form,
  zone,
  serverZone,
  serverTime,
  configured,
  pending,
  timeError,
  keepDaysError,
  offsiteError,
  valid,
  load,
  save,
} = useBackupConfig();
await useAsyncData("backups-config", () => load(), { server: false });
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-sliders-horizontal"
      color="neutral"
      variant="subtle"
      :title="t('backups.config.alertTitle')"
      :description="t('backups.config.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/backups" size="sm">
      {{ t("backups.config.back") }}
    </UButton>

    <USkeleton v-if="!loaded" class="h-64 w-full" />

    <template v-else-if="configured && overview">
      <BackupRequestStatus :pending="pending" :status="overview.lastRequest" />

      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("backups.config.title") }}</h2>
        </template>

        <div class="space-y-6">
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <UFormField
              :label="t('backups.config.time')"
              name="time"
              :description="t('backups.config.timeHint', { zone, serverTime, serverZone })"
              :error="timeError"
              class="row-span-2 grid grid-rows-subgrid gap-y-0"
            >
              <UInput v-model="form.time" type="time" class="w-full" :disabled="pending" />
            </UFormField>

            <UFormField
              :label="t('backups.config.keepDays')"
              name="keepDays"
              :description="t('backups.config.keepDaysHint')"
              :error="keepDaysError"
              class="row-span-2 grid grid-rows-subgrid gap-y-0"
            >
              <UInput v-model.number="form.keepDays" type="number" :min="1" :max="999" class="w-full" :disabled="pending" />
            </UFormField>
          </div>

          <UFormField
            :label="t('backups.config.offsite')"
            name="offsite"
            :description="t('backups.config.offsiteHint')"
            :error="offsiteError"
          >
            <UInput v-model="form.offsite" placeholder="backup@backup.example.com:/srv/mail" class="w-full" :disabled="pending" />
          </UFormField>

          <UCheckbox
            v-model="form.offsiteDeleteLocal"
            :disabled="pending || form.offsite.trim() === ''"
            :label="t('backups.config.deleteLocal')"
            :description="t('backups.config.deleteLocalHint')"
          />

          <UFormField :label="t('backups.config.dir')" name="dir" :description="t('backups.config.dirHint')">
            <UInput :model-value="overview.config?.dir ?? ''" class="w-full" disabled />
          </UFormField>

          <div class="flex justify-end">
            <UButton icon="i-lucide-check" color="primary" :loading="saving" :disabled="!valid" @click="save">
              {{ t("backups.config.save") }}
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
