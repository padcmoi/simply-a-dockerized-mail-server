<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.adminAlert.cardTitle") }]);

const { saving, loaded, form, emailError, valid, load, save } = useAdminAlertConfig();
await useAsyncData("config-admin-alert", () => load(), { server: false });
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-bell-ring"
      color="neutral"
      variant="subtle"
      :title="t('config.adminAlert.alertTitle')"
      :description="t('config.adminAlert.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/config" size="sm">
      {{ t("config.backToConfig") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("config.adminAlert.cardTitle") }}</h2>
      </template>

      <div v-if="!loaded" class="space-y-4">
        <USkeleton class="h-12 w-full" />
      </div>

      <div v-else class="space-y-6">
        <UFormField
          :label="t('config.adminAlert.email')"
          name="adminAlertEmail"
          :description="t('config.adminAlert.emailHint')"
          :error="emailError"
        >
          <UInput
            v-model="form.adminAlertEmail"
            type="email"
            placeholder="admin@example.com"
            class="w-full"
            @keyup.enter="save"
          />
        </UFormField>

        <div class="flex justify-end">
          <UButton icon="i-lucide-check" color="primary" :loading="saving" :disabled="!valid" @click="save">
            {{ t("config.adminAlert.save") }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
