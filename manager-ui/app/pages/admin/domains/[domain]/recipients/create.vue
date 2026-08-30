<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "create-recipient" },
  ],
});

const { t } = useI18n();
const { domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();

const {
  MIN_QUOTA_MB,
  MIN_PASSWORD_LENGTH,
  saving,
  form,
  headroom,
  availableMb,
  quotaUnderLimit,
  quotaOverLimit,
  localPartError,
  passwordError,
  formInvalid,
  pendingBytes,
  quotaSlider,
  sliderMax,
  listPath,
  create,
} = useRecipientForm();

// Below the composables it reads, unlike the computed above it: watchEffect
// runs its callback straight away, so `setBreadcrumb` must already be bound.
watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value, to: `/admin/domains/${domainFqdn.value}` },
    { label: t("nav.recipients"), to: listPath.value },
    { label: t("recipients.form.title") },
  ]);
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('recipients.alertTitle')"
      :description="t('recipients.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :to="listPath" size="sm">
      {{ t("recipients.backToList") }}
    </UButton>

    <!-- Two cards side by side above `lg`, stacked below, like the domain
         dashboard's own pairs. -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("recipients.form.title") }}</h2>
        </template>

        <!-- The domain is fixed by the route, so the address is only ever
             composed here; the API rebuilds it the same way from the local-part.
             `autocomplete="new-password"` below is what actually stops the
             browser: it breaks the username/password pairing its heuristic
             would otherwise apply to these two fields, filling them with the
             credentials of the account currently signed in. -->
        <UForm :state="form" class="space-y-4" autocomplete="off" @submit="create">
          <UFormField :label="t('recipients.form.localPart')" name="localPart" :error="localPartError">
            <UInput v-model="form.localPart" placeholder="local-part" autocomplete="off" class="w-full">
              <template #trailing>
                <FullTooltip :text="`@${domainFqdn}`"
                  ><span class="text-dimmed text-sm">@{{ truncateChars(domainFqdn, 24) }}</span></FullTooltip
                >
              </template>
            </UInput>
          </UFormField>
          <UFormField
            :label="t('recipients.form.password')"
            name="password"
            :error="passwordError"
            :hint="t('recipients.form.passwordMin', { value: MIN_PASSWORD_LENGTH })"
          >
            <UInput
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              :placeholder="t('recipients.form.password')"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('recipients.form.quotaMb')"
            name="quotaMb"
            :error="
              quotaUnderLimit
                ? t('recipients.form.quotaMin', { value: MIN_QUOTA_MB })
                : quotaOverLimit
                  ? t('recipients.form.quotaMax', { value: availableMb })
                  : undefined
            "
            :hint="t('recipients.form.quotaRange', { min: MIN_QUOTA_MB, max: availableMb })"
          >
            <USkeleton v-if="!headroom" class="h-8 w-full" />
            <div v-else class="space-y-4">
              <UInput v-model.number="form.quotaMb" type="number" :min="MIN_QUOTA_MB" :max="availableMb" class="w-full" />
              <USlider v-model="quotaSlider" :min="MIN_QUOTA_MB" :max="sliderMax" :step="1" class="px-1" />
            </div>
          </UFormField>
        </UForm>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" :to="listPath">{{ t("common.cancel") }}</UButton>
            <UButton icon="i-lucide-plus" :disabled="formInvalid" :loading="saving" @click="create">
              {{ t("recipients.form.submit") }}
            </UButton>
          </div>
        </template>
      </UCard>

      <!-- What the quota field's ceiling actually means, drawn: the same
           headroom call feeds both, and the donut follows the field as it is
           typed. -->
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("recipients.chart.title") }}</h2>
        </template>

        <div v-if="!headroom" class="flex flex-col items-center gap-6">
          <USkeleton class="w-40 h-40 rounded-full" />
          <div class="w-full space-y-2">
            <USkeleton v-for="i in 4" :key="i" class="h-4 w-full" />
          </div>
        </div>
        <RecipientHeadroomChart
          v-else
          :domain-quota="headroom.domainQuota"
          :allocated="headroom.allocated"
          :available="headroom.available"
          :pending="pendingBytes"
        />
      </UCard>
    </div>
  </div>
</template>
