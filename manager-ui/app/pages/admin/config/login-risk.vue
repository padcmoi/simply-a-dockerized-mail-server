<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.loginRisk.cardTitle") }]);

const {
  saving,
  loaded,
  radiusKm,
  order,
  orderItems,
  exclusive,
  cacheDays,
  addressDays,
  networkDays,
  valid,
  cacheValid,
  addressValid,
  networkValid,
  radiusError,
  cacheError,
  addressError,
  networkError,
  disabled,
  load,
  save,
  resetDefaults,
} = useLoginRiskConfig();
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

        <UFormField
          :label="t('config.loginRisk.address')"
          name="loginAddressDays"
          :description="t('config.loginRisk.addressHint')"
          :error="addressError"
        >
          <UInput v-model.number="addressDays" type="number" min="1" max="365" class="w-full sm:w-48">
            <template #trailing>
              <span class="text-xs text-dimmed">{{ t("config.loginRisk.addressUnit") }}</span>
            </template>
          </UInput>
        </UFormField>

        <UFormField
          :label="t('config.loginRisk.network')"
          name="loginNetworkDays"
          :description="t('config.loginRisk.networkHint')"
          :error="networkError"
        >
          <UInput v-model.number="networkDays" type="number" min="1" max="365" class="w-full sm:w-48">
            <template #trailing>
              <span class="text-xs text-dimmed">{{ t("config.loginRisk.networkUnit") }}</span>
            </template>
          </UInput>
        </UFormField>

        <USeparator />

        <UFormField
          :label="t('config.loginRisk.order')"
          name="loginChallengeOrder"
          :description="t('config.loginRisk.orderHint')"
        >
          <URadioGroup v-model="order" :items="orderItems" />
        </UFormField>

        <UFormField
          :label="t('config.loginRisk.exclusive')"
          name="loginChallengeExclusive"
          :description="t('config.loginRisk.exclusiveHint')"
        >
          <USwitch
            v-model="exclusive"
            :label="exclusive ? t('config.loginRisk.exclusiveOn') : t('config.loginRisk.exclusiveOff')"
          />
        </UFormField>

        <UAlert
          v-if="exclusive"
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          :title="t('config.loginRisk.exclusiveTitle')"
          :description="
            order === 'question,email' ? t('config.loginRisk.exclusiveQuestionOnly') : t('config.loginRisk.exclusiveMailOnly')
          "
        />

        <UAlert
          icon="i-lucide-smartphone"
          color="neutral"
          variant="subtle"
          :title="t('config.loginRisk.twoFactorTitle')"
          :description="t('config.loginRisk.twoFactorDescription')"
        />

        <USeparator />

        <UFormField
          :label="t('config.loginRisk.cache')"
          name="geoipCacheDays"
          :description="t('config.loginRisk.cacheHint')"
          :error="cacheError"
        >
          <UInput v-model.number="cacheDays" type="number" min="1" max="365" class="w-full sm:w-48">
            <template #trailing>
              <span class="text-xs text-dimmed">{{ t("config.loginRisk.cacheUnit") }}</span>
            </template>
          </UInput>
        </UFormField>

        <p class="text-sm text-muted">{{ t("config.loginRisk.providerNote") }}</p>

        <div class="flex justify-end gap-2">
          <UButton icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="resetDefaults">
            {{ t("config.loginRisk.reset") }}
          </UButton>
          <UButton
            icon="i-lucide-check"
            color="primary"
            :loading="saving"
            :disabled="!valid || !cacheValid || !addressValid || !networkValid"
            @click="save"
          >
            {{ t("config.loginRisk.save") }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
