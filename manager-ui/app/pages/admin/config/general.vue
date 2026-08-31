<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.general.cardTitle") }]);

const { saving, loaded, form, managerUrlError, valid, load, save } = useGeneralConfig();
await useAsyncData("config-general", () => load(), { server: false });
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-globe"
      color="neutral"
      variant="subtle"
      :title="t('config.general.alertTitle')"
      :description="t('config.general.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/config" size="sm">
      {{ t("config.backToConfig") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("config.general.cardTitle") }}</h2>
      </template>

      <div v-if="!loaded" class="space-y-4">
        <USkeleton class="h-12 w-full" />
      </div>

      <div v-else class="space-y-6">
        <UFormField
          :label="t('config.general.managerUrl')"
          name="managerUrl"
          :description="t('config.general.managerUrlHint')"
          :error="managerUrlError"
        >
          <UInput v-model="form.managerUrl" type="url" placeholder="https://mail-manager.example.com" class="w-full" />
        </UFormField>

        <div class="flex justify-end">
          <UButton icon="i-lucide-check" color="primary" :loading="saving" :disabled="!valid" @click="save">
            {{ t("config.general.save") }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
