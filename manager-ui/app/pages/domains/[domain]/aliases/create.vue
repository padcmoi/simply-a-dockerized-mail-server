<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "aliases", action: "access" },
    { resource: "aliases", action: "create" },
  ],
});

// Mirrors the local-part regex of aliases.validation.ts, which has no "@" in
// it on purpose: the domain comes from the route, never from this field.
const LOCAL_PART_PATTERN = /^[a-z0-9._+-]+$/i;
// Loose on purpose: the API's `z.string().email()` is the authority. This only
// catches the obvious before a round-trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const saving = ref(false);

// Field-level refusals from the API, dropped as soon as the field they judged
// is edited: they describe what was submitted, not what is now typed.
const serverErrors = ref<{ localPart?: string; destination?: string }>({});

const form = reactive({ localPart: "", destination: "" });

// An untouched field is not yet invalid: it shows no error, it only keeps the
// submit button disabled. Complaining before the user has typed is noise.
const localPartInvalid = computed(() => form.localPart.length > 0 && !LOCAL_PART_PATTERN.test(form.localPart));
const destinationInvalid = computed(() => form.destination.length > 0 && !EMAIL_PATTERN.test(form.destination));

const localPartError = computed(
  () => serverErrors.value.localPart ?? (localPartInvalid.value ? t("aliases.form.localPartInvalid") : undefined)
);
const destinationError = computed(
  () => serverErrors.value.destination ?? (destinationInvalid.value ? t("aliases.form.destinationInvalid") : undefined)
);

const formInvalid = computed(
  () =>
    !LOCAL_PART_PATTERN.test(form.localPart) ||
    !EMAIL_PATTERN.test(form.destination) ||
    Boolean(serverErrors.value.localPart) ||
    Boolean(serverErrors.value.destination)
);

const listPath = computed(() => `/domains/${domainFqdn.value}/aliases`);

const { t } = useI18n();
const { call } = useApi();
const { apiErrorBody, apiErrorStatus, apiErrorMessage } = useApiError();
const toast = useToast();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();

watch(
  () => form.localPart,
  () => (serverErrors.value.localPart = undefined)
);
watch(
  () => form.destination,
  () => (serverErrors.value.destination = undefined)
);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: domainFqdn.value, to: `/domains/${domainFqdn.value}` },
    { label: t("nav.aliases"), to: listPath.value },
    { label: t("aliases.form.title") },
  ]);
});

// A 409 is always about the source: an alias of this domain already uses that
// local-part.
function applyServerErrors(err: unknown) {
  if (apiErrorStatus(err) === 409) {
    serverErrors.value.localPart = apiErrorMessage(err);
    return;
  }
  for (const issue of apiErrorBody(err)?.issues ?? []) {
    if (issue.path[0] === "localPart") serverErrors.value.localPart = t("aliases.form.localPartInvalid");
    if (issue.path[0] === "destination") serverErrors.value.destination = t("aliases.form.destinationInvalid");
  }
}

async function create() {
  if (!domainId.value || formInvalid.value) return;
  saving.value = true;
  try {
    // Only the local-part travels: the API composes the source from the
    // route's domain, so an alias can never land on another domain.
    await call(`/domains/${domainId.value}/aliases`, {
      method: "POST",
      body: { localPart: form.localPart, destination: form.destination },
    });
    toast.add({ title: t("aliases.toast.created"), color: "success" });
    await navigateTo(listPath.value);
  } catch (err) {
    applyServerErrors(err);
    toast.add({ title: t("aliases.toast.createFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-info" :title="t('aliases.alertTitle')" />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :to="listPath" size="sm">
      {{ t("aliases.backToList") }}
    </UButton>

    <UCard class="max-w-3xl">
      <template #header>
        <h2 class="font-semibold">{{ t("aliases.form.title") }}</h2>
      </template>

      <UForm :state="form" class="space-y-4" autocomplete="off" @submit="create">
        <!-- The domain is fixed by the route and appended by the API: the field
             holds a local-part and shows the suffix it will receive. -->
        <UFormField :label="t('aliases.form.localPart')" name="localPart" :error="localPartError">
          <UInput v-model="form.localPart" placeholder="local-part" autocomplete="off" class="w-full">
            <template #trailing>
              <span class="text-dimmed text-sm truncate">@{{ domainFqdn }}</span>
            </template>
          </UInput>
        </UFormField>

        <UFormField :label="t('aliases.form.destination')" name="destination" :error="destinationError">
          <UInput
            v-model="form.destination"
            :placeholder="t('aliases.form.destinationPlaceholder')"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
      </UForm>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" :to="listPath">{{ t("common.cancel") }}</UButton>
          <UButton icon="i-lucide-plus" :disabled="formInvalid" :loading="saving" @click="create">
            {{ t("aliases.form.submit") }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
