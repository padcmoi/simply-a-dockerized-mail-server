<script setup lang="ts">
definePageMeta({});

const route = useRoute();
const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

const confirmDelete = ref(false);
const recipientId = computed(() => Number(route.params.id));

const {
  PASSWORD_MIN,
  recipient,
  loading,
  loadError,
  form,
  delegation,
  passwordTooShort,
  canChangePassword,
  minQuotaMb,
  maxQuotaMb,
  quotaUnderMin,
  savingStatus,
  changingPassword,
  savingQuota,
  deleting,
  changePassword,
  remove,
} = useMySpaceRecipient(() => recipientId.value);

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.myspace"), to: "/my-space" }, { label: recipient.value?.email ?? "..." }]);
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/my-space" size="sm">
      {{ t("myspace.backToSpace") }}
    </UButton>

    <div v-if="loading" class="space-y-4">
      <USkeleton v-for="i in 2" :key="i" class="h-40 w-full" />
    </div>

    <UAlert
      v-else-if="loadError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="loadError === 'notFound' ? t('myspace.recipient.notFound') : t('myspace.recipient.loadFailed')"
    />

    <template v-else-if="recipient">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UCard :ui="{ root: 'flex flex-col', body: 'flex-1 flex items-center' }">
          <template #header>
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="rounded-md p-2 bg-elevated shrink-0">
                <UIcon name="i-lucide-mailbox" class="size-4 text-primary" />
              </div>
              <div class="min-w-0">
                <TruncatedText :text="recipient.email" :limit="40" text-class="font-semibold" />
                <p class="text-xs text-muted truncate">{{ recipient.domain }}</p>
              </div>
            </div>
          </template>

          <MailboxUsageDonut :total-bytes="Number(recipient.quota)" :used-bytes="Number(recipient.usedBytes)" />
        </UCard>

        <div class="space-y-6">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-4">
                <h2 class="font-semibold flex items-center gap-1.5">
                  <UIcon name="i-lucide-power" class="size-4 text-muted" />
                  {{ t("myspace.recipient.active") }}
                </h2>
                <AutosaveState :saving="savingStatus" />
              </div>
            </template>

            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <USwitch v-model="form.active" />
                <UBadge :color="form.active ? 'success' : 'neutral'" variant="subtle">
                  {{ form.active ? t("common.active") : t("common.inactive") }}
                </UBadge>
              </div>
              <p class="text-sm text-muted">{{ t("myspace.recipient.activeHint") }}</p>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold flex items-center gap-1.5">
                <UIcon name="i-lucide-key-round" class="size-4 text-muted" />
                {{ t("myspace.recipient.passwordTitle") }}
              </h2>
            </template>

            <div class="space-y-3">
              <p class="text-sm text-muted">{{ t("myspace.recipient.passwordHint") }}</p>
              <div class="flex items-end gap-2">
                <UFormField
                  :label="t('myspace.recipient.newPassword')"
                  :error="passwordTooShort ? t('myspace.recipient.passwordMin', { value: PASSWORD_MIN }) : undefined"
                  class="flex-1 sm:max-w-sm"
                >
                  <UInput
                    v-model="form.password"
                    type="password"
                    autocomplete="new-password"
                    :placeholder="t('myspace.recipient.newPasswordPlaceholder')"
                    class="w-full"
                  />
                </UFormField>
                <UButton
                  icon="i-lucide-key-round"
                  :disabled="!canChangePassword"
                  :loading="changingPassword"
                  @click="changePassword"
                >
                  {{ t("myspace.recipient.changePassword") }}
                </UButton>
              </div>
            </div>
          </UCard>

          <UCard v-if="delegation">
            <template #header>
              <div class="flex items-center justify-between gap-4">
                <h2 class="font-semibold flex items-center gap-1.5">
                  <UIcon name="i-lucide-database" class="size-4 text-muted" />
                  {{ t("myspace.recipient.quota") }}
                </h2>
                <AutosaveState :saving="savingQuota" />
              </div>
            </template>

            <div class="space-y-3">
              <p class="text-sm text-muted">{{ t("myspace.recipient.quotaEditHint") }}</p>
              <UFormField
                :label="t('myspace.delegations.quotaMb')"
                :hint="t('recipients.form.quotaRange', { min: minQuotaMb, max: maxQuotaMb })"
                :error="quotaUnderMin ? t('recipients.form.quotaMin', { value: minQuotaMb }) : undefined"
              >
                <div class="space-y-4">
                  <UInput v-model.number="form.quotaMb" type="number" :min="minQuotaMb" :max="maxQuotaMb" class="w-32" />
                  <USlider v-model="form.quotaMb" :min="minQuotaMb" :max="maxQuotaMb" :step="1" class="px-1" />
                </div>
              </UFormField>
              <p class="text-xs text-muted">
                {{ t("myspace.delegations.quotaAvailable", { used: Math.round(Number(form.quotaMb) || 0), max: maxQuotaMb }) }}
              </p>
            </div>
          </UCard>
        </div>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-error font-semibold flex items-center gap-1.5">
            <UIcon name="i-lucide-triangle-alert" class="size-4" />
            {{ t("myspace.recipient.deleteTitle") }}
          </h2>
        </template>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p class="text-sm text-muted">{{ t("myspace.recipient.deleteHint") }}</p>
          <UButton
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            :loading="deleting"
            @click="
              () => {
                confirmDelete = true;
              }
            "
          >
            {{ t("myspace.recipient.delete") }}
          </UButton>
        </div>
      </UCard>

      <ConfirmModal v-model:open="confirmDelete" :description="t('myspace.recipient.deleteConfirm')" @confirm="remove" />
    </template>
  </div>
</template>
