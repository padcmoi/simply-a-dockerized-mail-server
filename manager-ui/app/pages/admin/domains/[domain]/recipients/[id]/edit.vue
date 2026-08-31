<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "edit-recipient" },
  ],
});

const { t } = useI18n();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();

const {
  PASSWORD_MIN,
  recipient,
  loading,
  saving,
  changingPassword,
  form,
  listPath,
  isPostmaster,
  canAssignOwner,
  canUnassignOwner,
  floorMb,
  maxQuotaMb,
  sliderMax,
  quotaUnderLimit,
  quotaOverLimit,
  passwordTooShort,
  canChangePassword,
  formInvalid,
  load,
  save,
  changePassword,
} = useRecipientEdit();

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value, to: `/admin/domains/${domainFqdn.value}` },
    { label: t("nav.recipients"), to: listPath.value },
    { label: recipient.value?.email ?? "..." },
    { label: t("recipients.editPage.button") },
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

    <UCard>
      <template #header>
        <h2 class="font-semibold truncate">
          {{ recipient ? t("recipients.editPage.title", { email: recipient.email }) : t("recipients.editPage.button") }}
        </h2>
      </template>

      <div v-if="loading" class="space-y-4">
        <USkeleton v-for="i in 2" :key="i" class="h-14 w-full" />
      </div>

      <UForm v-else :state="form" class="space-y-4" @submit="save">
        <UFormField :label="t('domains.form.active')" name="active">
          <USwitch v-model="form.active" />
        </UFormField>

        <UFormField
          :label="t('recipients.form.quotaMb')"
          name="quotaMb"
          :error="
            quotaUnderLimit
              ? t('recipients.form.quotaMin', { value: floorMb })
              : quotaOverLimit
                ? t('recipients.form.quotaMax', { value: maxQuotaMb })
                : undefined
          "
          :hint="t('recipients.form.quotaRange', { min: floorMb, max: maxQuotaMb })"
        >
          <!-- Slider and number field are two views of `form.quotaMb`, so
               moving either moves the other. -->
          <div class="space-y-4">
            <UInput v-model.number="form.quotaMb" type="number" :min="floorMb" :max="maxQuotaMb" class="w-32" />
            <USlider v-model="form.quotaMb" :min="floorMb" :max="sliderMax" :step="1" class="px-1" />
          </div>
        </UFormField>
      </UForm>

      <div
        v-if="recipient && domainId && !isPostmaster && (recipient.ownerEmail || canAssignOwner || canUnassignOwner)"
        class="pt-4 mt-4 border-t border-default"
      >
        <MailboxOwnerField
          kind="recipients"
          :domain-id="domainId"
          :resource-id="recipient.id"
          :owner-email="recipient.ownerEmail"
          :can-assign="canAssignOwner"
          :can-unassign="canUnassignOwner"
          @changed="load"
        />
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" :to="listPath">{{ t("common.cancel") }}</UButton>
          <UButton icon="i-lucide-save" :disabled="formInvalid" :loading="saving" @click="save">
            {{ t("common.save") }}
          </UButton>
        </div>
      </template>
    </UCard>

    <UCard v-if="recipient && !isPostmaster">
      <template #header>
        <h2 class="font-semibold flex items-center gap-1.5">
          <UIcon name="i-lucide-key-round" class="size-4 text-muted" />
          {{ t("recipients.passwordCard.title") }}
        </h2>
      </template>

      <div class="space-y-3">
        <p class="text-sm text-muted">{{ t("recipients.form.passwordKeepHint") }}</p>
        <div class="flex items-end gap-2">
          <UFormField
            :label="t('recipients.form.newPassword')"
            :error="passwordTooShort ? t('recipients.form.passwordMin', { value: PASSWORD_MIN }) : undefined"
            class="flex-1 sm:max-w-sm"
          >
            <UInput
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              :placeholder="t('recipients.form.newPasswordPlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UButton icon="i-lucide-key-round" :disabled="!canChangePassword" :loading="changingPassword" @click="changePassword">
            {{ t("recipients.form.changePassword") }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
