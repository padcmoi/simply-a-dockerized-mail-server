<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.postfix.cardTitle") }]);

const {
  saving,
  loaded,
  form,
  hostname,
  domains,
  status,
  appliedAt,
  localPartError,
  delayWarningError,
  lifetimeError,
  valid,
  senderDisplay,
  load,
  save,
  resetDefaults,
} = usePostfixConfig();
await useAsyncData("postfix-config", () => load(), { server: false });

const DEFAULT_DOMAIN = "default";

const domainItems = computed(() => [
  { label: t("config.postfix.senderDefault", { hostname: hostname.value }), value: DEFAULT_DOMAIN },
  ...domains.value.map((domain) => ({ label: domain, value: domain })),
]);

const domain = computed({
  get: () => form.bounceSenderDomain || DEFAULT_DOMAIN,
  set: (value: string) => {
    form.bounceSenderDomain = value === DEFAULT_DOMAIN ? "" : value;
  },
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-send"
      color="neutral"
      variant="subtle"
      :title="t('config.postfix.alertTitle')"
      :description="t('config.postfix.alertDescription')"
    />

    <div class="flex flex-wrap items-center justify-between gap-2">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/config" size="sm">
        {{ t("config.backToConfig") }}
      </UButton>
      <UButton icon="i-lucide-list-ordered" color="neutral" variant="outline" to="/admin/postfix" size="sm">
        {{ t("config.postfix.queueLink") }}
      </UButton>
    </div>

    <div v-if="!loaded" class="space-y-4">
      <USkeleton class="h-16 w-full" />
      <USkeleton v-for="i in 2" :key="i" class="h-64 w-full" />
    </div>

    <template v-else>
      <PostfixApplyStatus :status="status" :applied-at="appliedAt" />

      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("config.postfix.bounceTitle") }}</h2>
        </template>

        <div class="space-y-6">
          <UFormField :label="t('config.postfix.sender')" name="domain" :description="t('config.postfix.senderHint')">
            <USelectMenu v-model="domain" value-key="value" :items="domainItems" class="w-full sm:w-96" />
          </UFormField>

          <UFormField
            :label="t('config.postfix.localPart')"
            name="localPart"
            :description="t('config.postfix.localPartHint')"
            :error="form.bounceSenderDomain ? localPartError : undefined"
          >
            <UInput
              v-model.trim="form.bounceSenderLocal"
              :disabled="!form.bounceSenderDomain"
              maxlength="64"
              class="w-full sm:w-96"
            />
          </UFormField>

          <div class="rounded-md border border-default p-3 text-sm">
            <span class="text-muted">{{ t("config.postfix.preview") }}</span>
            <span class="ml-2 font-mono break-all">{{ senderDisplay }}</span>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("config.postfix.queueTitle") }}</h2>
        </template>

        <div class="space-y-6">
          <UFormField
            :label="t('config.postfix.delayWarning')"
            name="delayWarning"
            :description="t('config.postfix.delayWarningHint')"
            :error="delayWarningError"
          >
            <UInput v-model.number="form.delayWarningHours" type="number" :min="0" :max="24" class="w-full sm:w-48" />
          </UFormField>

          <UFormField
            :label="t('config.postfix.lifetime')"
            name="lifetime"
            :description="t('config.postfix.lifetimeHint')"
            :error="lifetimeError"
          >
            <UInput v-model.number="form.maximalQueueLifetimeDays" type="number" :min="1" :max="5" class="w-full sm:w-48" />
          </UFormField>
        </div>
      </UCard>

      <div class="flex justify-end gap-2">
        <UButton icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="resetDefaults">
          {{ t("config.postfix.reset") }}
        </UButton>
        <UButton icon="i-lucide-check" color="primary" :loading="saving" :disabled="!valid" @click="save">
          {{ t("config.postfix.save") }}
        </UButton>
      </div>
    </template>
  </div>
</template>
