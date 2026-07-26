<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/config" }, { label: t("config.mail.cardTitle") }]);

const {
  userEmail,
  saving,
  testing,
  verifying,
  activating,
  otp,
  otpError,
  sendError,
  otpSent,
  resendIn,
  active,
  selected,
  isSelected,
  form,
  providerOptions,
  isOff,
  providerHint,
  showServer,
  activeLabel,
  steps,
  stepperColor,
  usernameLabel,
  usernameHint,
  usernamePlaceholder,
  passwordLabel,
  passwordHint,
  passwordPlaceholder,
  fromHint,
  readOnly,
  summaryRows,
  providerLabel,
  load,
  saveStep,
  sendTest,
  onOtpInput,
  editing,
  activate,
  edit,
  cancelEdit,
  backToConfig,
  refreshList,
} = useMailConfig();

const { status } = await useAsyncData("mail-config", () => load(), { server: false });

watch(useDataRefresh().tick, () => refreshList().catch(() => undefined));
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-mail"
      color="neutral"
      variant="subtle"
      :title="t('config.mail.alertTitle')"
      :description="t('config.mail.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/config" size="sm">
      {{ t("config.backToConfig") }}
    </UButton>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h2 class="font-semibold">{{ t("config.mail.cardTitle") }}</h2>
          <UBadge v-if="selected" color="success" variant="subtle" icon="i-lucide-badge-check">
            {{ t("config.mail.activeBadge", { provider: activeLabel }) }}
          </UBadge>
          <UBadge v-else color="neutral" variant="subtle" icon="i-lucide-mail-x">
            {{ t("config.mail.disabledBadge") }}
          </UBadge>
        </div>
      </template>

      <div v-if="status === 'pending'" class="space-y-4">
        <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <div v-else class="space-y-6">
        <UFormField :label="t('config.mail.provider')" name="provider">
          <USelectMenu v-model="form.provider" value-key="value" :items="providerOptions" class="w-full sm:w-72" />
        </UFormField>

        <p class="text-sm text-muted">{{ providerHint }}</p>

        <UStepper v-if="!isOff" v-model="active" :items="steps" :color="stepperColor" size="sm">
          <template #content="{ item }">
            <div v-if="item.value === 'config'" class="space-y-4 pt-4">
              <UAlert
                v-if="sendError"
                color="error"
                variant="subtle"
                icon="i-lucide-triangle-alert"
                :title="t('config.mail.testFailed')"
                :description="sendError"
              />
              <template v-if="readOnly">
                <dl class="divide-y divide-default">
                  <div v-for="r in summaryRows" :key="r.label" class="flex items-center justify-between gap-4 py-2.5">
                    <dt class="text-sm text-muted">{{ r.label }}</dt>
                    <dd class="text-sm font-medium break-all">{{ r.value }}</dd>
                  </div>
                </dl>
                <div class="flex justify-end">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="outline" @click="edit">
                    {{ t("config.mail.modify") }}
                  </UButton>
                </div>
              </template>

              <template v-else>
                <template v-if="showServer">
                  <UFormField :label="t('config.mail.host')" name="host">
                    <UInput v-model="form.host" placeholder="smtp.example.com" class="w-full" />
                  </UFormField>
                  <UFormField :label="t('config.mail.port')" name="port" :description="t('config.mail.portHint')">
                    <UInput v-model.number="form.port" type="number" :min="1" :max="65535" class="w-full sm:w-40" />
                  </UFormField>
                </template>

                <UFormField :label="usernameLabel" name="username" :description="usernameHint">
                  <UInput v-model="form.username" autocomplete="off" :placeholder="usernamePlaceholder" class="w-full" />
                </UFormField>
                <UFormField :label="passwordLabel" name="password" :description="passwordHint">
                  <UInput
                    v-model="form.password"
                    type="password"
                    autocomplete="new-password"
                    :placeholder="passwordPlaceholder"
                    class="w-full"
                  />
                </UFormField>
                <UFormField :label="t('config.mail.fromAddress')" name="fromAddress" :description="fromHint">
                  <UInput v-model="form.fromAddress" placeholder="noreply@yourdomain.com" class="w-full" />
                </UFormField>

                <div class="flex justify-end gap-2">
                  <UButton v-if="editing" color="neutral" variant="ghost" @click="cancelEdit">
                    {{ t("common.cancel") }}
                  </UButton>
                  <UButton icon="i-lucide-arrow-right" trailing color="primary" :loading="saving" @click="saveStep">
                    {{ t("config.mail.validate") }}
                  </UButton>
                </div>
              </template>
            </div>

            <div v-else-if="item.value === 'verify'" class="space-y-4 pt-4">
              <p class="text-sm text-muted">
                {{ otpSent ? t("config.mail.codeSentTo", { email: userEmail }) : t("config.mail.otpHint") }}
              </p>
              <UFormField :label="t('config.mail.otpLabel')" name="otp">
                <UPinInput
                  :model-value="otp"
                  :length="6"
                  type="number"
                  :color="otpError ? 'error' : 'primary'"
                  :disabled="verifying"
                  @update:model-value="onOtpInput"
                />
                <p v-if="otpError" class="text-error text-sm mt-1.5">{{ t("config.mail.otpWrong") }}</p>
              </UFormField>
              <div class="flex items-center gap-2">
                <UButton variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" @click="backToConfig">
                  {{ t("common.back") }}
                </UButton>
                <UButton
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-rotate-cw"
                  size="sm"
                  :disabled="resendIn > 0"
                  :loading="testing"
                  @click="sendTest"
                >
                  {{ resendIn > 0 ? t("config.mail.resendIn", { s: resendIn }) : t("config.mail.resend") }}
                </UButton>
              </div>
            </div>

            <div v-else class="space-y-4 pt-4">
              <div class="flex items-center gap-2 text-success">
                <UIcon name="i-lucide-badge-check" class="size-5 shrink-0" />
                <p class="font-medium">
                  {{
                    isSelected
                      ? t("config.mail.doneActive", { provider: providerLabel(form.provider) })
                      : t("config.mail.doneValidated", { provider: providerLabel(form.provider) })
                  }}
                </p>
              </div>
              <div v-if="!isSelected" class="flex justify-end">
                <UButton color="primary" icon="i-lucide-power" :loading="activating" @click="activate">
                  {{ t("config.mail.useProvider") }}
                </UButton>
              </div>
            </div>
          </template>
        </UStepper>
      </div>
    </UCard>
  </div>
</template>
