<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config") }]);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-settings-2"
      :title="t('config.landingAlertTitle')"
      :description="t('config.landingAlertDescription')"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <ProfileActionCard
        icon="i-lucide-globe"
        :label="t('config.generalCardLabel')"
        :hint="t('config.generalCardHint')"
        to="/admin/config/general"
      />

      <ProfileActionCard
        icon="i-lucide-mail"
        :label="t('config.mailCardLabel')"
        :hint="t('config.mailCardHint')"
        to="/admin/config/mail"
      />

      <ProfileActionCard
        icon="i-lucide-timer"
        :label="t('config.cadenceCardLabel')"
        :hint="t('config.cadenceCardHint')"
        to="/admin/config/mail-cadence"
      />

      <ProfileActionCard
        icon="i-lucide-activity"
        :label="t('config.supervisionCardLabel')"
        :hint="t('config.supervisionCardHint')"
        to="/admin/config/supervision"
      />

      <ProfileActionCard
        icon="i-lucide-palette"
        :label="t('config.themeCardLabel')"
        :hint="t('config.themeCardHint')"
        to="/admin/config/theme"
      />
    </div>
  </div>
</template>
