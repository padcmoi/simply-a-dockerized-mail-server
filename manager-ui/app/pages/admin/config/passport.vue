<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.passport.cardTitle") }]);

const { saving, loaded, enabled, autoProvision, providers, managerUrlSet, load, saveProvider, forgetProvider } =
  usePassportConfig();
await useAsyncData("passport-config-admin", () => load(), { server: false });
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-key-square"
      color="neutral"
      variant="subtle"
      :title="t('config.passport.alertTitle')"
      :description="t('config.passport.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/config" size="sm">
      {{ t("config.backToConfig") }}
    </UButton>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h2 class="font-semibold">{{ t("config.passport.cardTitle") }}</h2>
          <span v-if="saving" class="flex items-center gap-1.5 text-sm text-muted">
            <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
            {{ t("config.passport.saving") }}
          </span>
          <span v-else class="text-sm text-muted">{{ t("config.passport.autosaveHint") }}</span>
        </div>
      </template>

      <div v-if="!loaded" class="space-y-4">
        <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <div v-else class="space-y-6">
        <UAlert
          v-if="!managerUrlSet"
          icon="i-lucide-triangle-alert"
          color="error"
          variant="subtle"
          :title="t('config.passport.managerUrlMissingTitle')"
          :description="t('config.passport.managerUrlMissing')"
          :actions="[
            {
              label: t('config.passport.managerUrlAction'),
              to: '/admin/config/general',
              color: 'neutral',
              variant: 'outline',
            },
          ]"
        />

        <UFormField :label="t('config.passport.enabled')" name="enabled" :description="t('config.passport.enabledHint')">
          <USwitch v-model="enabled" :label="enabled ? t('config.passport.enabledOn') : t('config.passport.enabledOff')" />
        </UFormField>

        <USeparator :label="t('config.passport.providersSection')" />

        <div class="space-y-3">
          <PassportProviderCard
            v-for="provider in providers"
            :key="provider.id"
            :provider="provider"
            :saving="saving"
            :disabled="!enabled"
            @save="saveProvider(provider.id, $event)"
            @forget="forgetProvider(provider.id)"
          />
        </div>

        <USeparator :label="t('config.passport.accountsSection')" />

        <UFormField
          :label="t('config.passport.autoProvision')"
          name="autoProvision"
          :description="t('config.passport.autoProvisionHint')"
        >
          <USwitch
            v-model="autoProvision"
            :disabled="!enabled"
            :label="autoProvision ? t('config.passport.on') : t('config.passport.off')"
          />
        </UFormField>

        <UAlert
          v-if="autoProvision && enabled"
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          :description="t('config.passport.autoProvisionWarning')"
        />
      </div>
    </UCard>
  </div>
</template>
