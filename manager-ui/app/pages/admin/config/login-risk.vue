<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.loginRisk.cardTitle") }]);

const { saving, loaded, radiusKm, order, orderItems, valid, radiusError, disabled, load, save, resetDefaults } =
  useLoginRiskConfig();
await useAsyncData("config-login-risk", () => load(), { server: false });
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-map-pin"
      color="neutral"
      variant="subtle"
      :title="t('config.loginRisk.alertTitle')"
      :description="t('config.loginRisk.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/config" size="sm">
      {{ t("config.backToConfig") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("config.loginRisk.cardTitle") }}</h2>
      </template>

      <div v-if="!loaded" class="space-y-4">
        <USkeleton class="h-12 w-full" />
      </div>

      <div v-else class="space-y-6">
        <UFormField
          :label="t('config.loginRisk.radius')"
          name="loginRadiusKm"
          :description="t('config.loginRisk.radiusHint')"
          :error="radiusError"
        >
          <UInput v-model.number="radiusKm" type="number" min="0" max="20037" class="w-full sm:w-48">
            <template #trailing>
              <span class="text-xs text-dimmed">{{ t("config.loginRisk.radiusUnit") }}</span>
            </template>
          </UInput>
        </UFormField>

        <UAlert
          v-if="disabled"
          icon="i-lucide-shield-off"
          color="warning"
          variant="subtle"
          :title="t('config.loginRisk.offTitle')"
          :description="t('config.loginRisk.offDescription')"
        />

        <USeparator />

        <UFormField
          :label="t('config.loginRisk.order')"
          name="loginChallengeOrder"
          :description="t('config.loginRisk.orderHint')"
        >
          <URadioGroup v-model="order" :items="orderItems" :disabled="disabled" />
        </UFormField>

        <UAlert
          icon="i-lucide-smartphone"
          color="neutral"
          variant="subtle"
          :title="t('config.loginRisk.twoFactorTitle')"
          :description="t('config.loginRisk.twoFactorDescription')"
        />

        <p class="text-sm text-muted">{{ t("config.loginRisk.accuracyNote") }}</p>

        <div class="flex justify-end gap-2">
          <UButton icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="resetDefaults">
            {{ t("config.loginRisk.reset") }}
          </UButton>
          <UButton icon="i-lucide-check" color="primary" :loading="saving" :disabled="!valid" @click="save">
            {{ t("config.loginRisk.save") }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
