<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "tickets", action: "access" },
    { resource: "tickets", action: "create-ticket" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

const visibilityOptions = computed(() => [
  { value: "private", label: t("tickets.form.private") },
  { value: "public", label: t("tickets.form.public") },
]);

setBreadcrumb([{ label: t("nav.tickets"), to: "/admin/tickets" }, { label: t("tickets.form.title") }]);

const {
  form,
  saving,
  loadingDomains,
  loadingResources,
  domainOptions,
  recipientOptions,
  aliasOptions,
  hasResourceOptions,
  resourcesRequired,
  resourcesMissing,
  formInvalid,
  create,
} = useTicketCreate();

const visibilityHint = computed(() =>
  form.visibility === "public" ? t("tickets.form.publicHint") : t("tickets.form.privateHint")
);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-life-buoy"
      :title="t('tickets.alertTitle')"
      :description="t('tickets.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/tickets" size="sm">
      {{ t("tickets.form.backToList") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("tickets.form.title") }}</h2>
      </template>

      <UForm :state="form" class="space-y-4" @submit="create">
        <UFormField :label="t('common.domain')" name="domainId" required>
          <USkeleton v-if="loadingDomains" class="h-8 w-full sm:w-72" />
          <USelectMenu v-else v-model="form.domainId" value-key="value" :items="domainOptions" class="w-full sm:w-72" />
        </UFormField>

        <UFormField :label="t('tickets.form.subject')" name="subject" required>
          <UInput v-model="form.subject" :placeholder="t('tickets.form.subjectPlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('tickets.form.body')" name="body" required>
          <MessageEditor v-model="form.body" framed base-class="min-h-40" />
        </UFormField>

        <div v-if="form.domainId !== undefined" class="space-y-4">
          <USkeleton v-if="loadingResources" class="h-8 w-full" />

          <template v-else-if="hasResourceOptions">
            <p class="text-sm" :class="resourcesMissing ? 'text-error' : 'text-muted'">
              {{ resourcesRequired ? t("tickets.form.resourcesRequiredHint") : t("tickets.form.resourcesOptionalHint") }}
            </p>

            <UFormField v-if="recipientOptions.length" :label="t('tickets.form.recipients')" name="recipientIds">
              <USelectMenu
                v-model="form.recipientIds"
                multiple
                value-key="value"
                icon="i-lucide-users"
                :items="recipientOptions"
                :placeholder="t('tickets.form.recipientsPlaceholder')"
                class="w-full"
              />
            </UFormField>

            <UFormField v-if="aliasOptions.length" :label="t('tickets.form.aliases')" name="aliasIds">
              <USelectMenu
                v-model="form.aliasIds"
                multiple
                value-key="value"
                icon="i-lucide-at-sign"
                :items="aliasOptions"
                :placeholder="t('tickets.form.aliasesPlaceholder')"
                class="w-full"
              />
            </UFormField>
          </template>

          <p v-else class="text-sm text-muted">{{ t("tickets.form.noResources") }}</p>
        </div>

        <UFormField :label="t('tickets.form.visibility')" name="visibility" :hint="visibilityHint">
          <USelectMenu v-model="form.visibility" value-key="value" :items="visibilityOptions" class="w-full sm:w-56" />
        </UFormField>
      </UForm>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" to="/admin/tickets">{{ t("common.cancel") }}</UButton>
          <UButton icon="i-lucide-plus" :disabled="formInvalid" :loading="saving" @click="create">
            {{ t("tickets.form.submit") }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
