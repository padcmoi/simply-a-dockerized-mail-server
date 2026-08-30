<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "tickets", action: "access" },
    { resource: "tickets", action: "create-ticket" },
  ],
});

const saving = ref(false);
const form = reactive({
  domainId: undefined as number | undefined,
  subject: "",
  body: "",
  visibility: "private" as "public" | "private",
});

const formInvalid = computed(() => !form.domainId || form.subject.trim().length === 0 || form.body.trim().length === 0);

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();

const visibilityOptions = computed(() => [
  { value: "private", label: t("tickets.form.private") },
  { value: "public", label: t("tickets.form.public") },
]);
const visibilityHint = computed(() =>
  form.visibility === "public" ? t("tickets.form.publicHint") : t("tickets.form.privateHint")
);

setBreadcrumb([{ label: t("nav.tickets"), to: "/admin/tickets" }, { label: t("tickets.form.title") }]);

const { data: domains } = useAsyncData<DomainOption[]>("tickets-domains", () => call<DomainOption[]>("/tickets/domains"), {
  server: false,
  default: () => [],
});
const domainOptions = computed(() => (domains.value ?? []).map((d) => ({ value: d.id, label: d.domain })));

async function create() {
  if (formInvalid.value) return;
  saving.value = true;
  try {
    await call("/tickets", {
      method: "POST",
      body: {
        domainId: form.domainId,
        subject: form.subject.trim(),
        body: form.body.trim(),
        visibility: form.visibility,
      },
    });
    toast.add({ title: t("tickets.toast.created"), color: "success" });
    await navigateTo("/admin/tickets");
  } catch (err) {
    toast.add({ title: t("tickets.toast.createFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    saving.value = false;
  }
}
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
        <UFormField :label="t('common.domain')" name="domainId">
          <USelectMenu v-model="form.domainId" value-key="value" :items="domainOptions" class="w-full sm:w-72" />
        </UFormField>
        <UFormField :label="t('tickets.form.subject')" name="subject">
          <UInput v-model="form.subject" :placeholder="t('tickets.form.subjectPlaceholder')" class="w-full" />
        </UFormField>
        <UFormField :label="t('tickets.form.body')" name="body">
          <UTextarea v-model="form.body" :rows="6" :placeholder="t('tickets.form.bodyPlaceholder')" class="w-full" />
        </UFormField>
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
