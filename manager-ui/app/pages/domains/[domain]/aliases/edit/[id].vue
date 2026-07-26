<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "aliases", action: "access" },
    { resource: "aliases", action: "edit-alias" },
  ],
});

interface Alias {
  id: number;
  source: string;
  destination: string;
  domain: string;
  ownerEmail: string | null;
}

// Mirrors the local-part regex of aliases.validation.ts, which has no "@" in
// it on purpose: the domain comes from the route, never from this field.
const LOCAL_PART_PATTERN = /^[a-z0-9._+-]+$/i;
// Loose on purpose: the API's `z.string().email()` is the authority. This only
// catches the obvious before a round-trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const alias = ref<Alias | null>(null);
const loading = ref(true);
const saving = ref(false);

// Field-level refusals from the API, dropped as soon as the field they judged
// is edited: they describe what was submitted, not what is now typed.
const serverErrors = ref<{ localPart?: string; destination?: string }>({});

const form = reactive({ localPart: "", destination: "" });

const localPartInvalid = computed(() => form.localPart.length > 0 && !LOCAL_PART_PATTERN.test(form.localPart));
const destinationInvalid = computed(() => form.destination.length > 0 && !EMAIL_PATTERN.test(form.destination));

const localPartError = computed(
  () => serverErrors.value.localPart ?? (localPartInvalid.value ? t("aliases.form.localPartInvalid") : undefined)
);
const destinationError = computed(
  () => serverErrors.value.destination ?? (destinationInvalid.value ? t("aliases.form.destinationInvalid") : undefined)
);

// Nothing to save until something actually differs from what was loaded.
const dirty = computed(
  () =>
    alias.value !== null &&
    (`${form.localPart}@${domainFqdn.value}` !== alias.value.source || form.destination !== alias.value.destination)
);

const formInvalid = computed(
  () =>
    !LOCAL_PART_PATTERN.test(form.localPart) ||
    !EMAIL_PATTERN.test(form.destination) ||
    !dirty.value ||
    Boolean(serverErrors.value.localPart) ||
    Boolean(serverErrors.value.destination)
);

const listPath = computed(() => `/domains/${domainFqdn.value}/aliases`);

const isPostmaster = computed(() => !!alias.value?.source.toLowerCase().startsWith("postmaster@"));
const canAssignOwner = computed(
  () => !isPostmaster.value && !!domainId.value && (isRoot.value || hasDomain(domainId.value, "mailboxes", "assign-alias-owner"))
);
const canUnassignOwner = computed(
  () =>
    !isPostmaster.value && !!domainId.value && (isRoot.value || hasDomain(domainId.value, "mailboxes", "unassign-alias-owner"))
);

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const { apiErrorBody, apiErrorStatus, apiErrorMessage } = useApiError();
const toast = useToast();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();
const { isRoot, hasDomain } = usePermissions();

const aliasId = computed(() => Number(route.params.id));

// `domainId` starts null on a hard reload and resolves only once
// useCurrentDomain has matched the slug, so the fetch has to watch it.
watch(domainId, load, { immediate: true });

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
    { label: alias.value?.source ?? "..." },
  ]);
});

async function load() {
  if (!domainId.value) return;
  loading.value = true;
  try {
    const found = await call<Alias>(`/domains/${domainId.value}/aliases/${aliasId.value}`);
    alias.value = found;
    // The stored source carries the domain; the field must not. Splitting on
    // the last "@" is what the API's own composition implies.
    form.localPart = found.source.slice(0, found.source.lastIndexOf("@"));
    form.destination = found.destination;
  } catch (err) {
    toast.add({ title: t("aliases.editPage.loadFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    loading.value = false;
  }
}

// A 409 is always about the source: another alias of this domain already uses
// that local-part.
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

async function save() {
  if (!domainId.value || formInvalid.value) return;
  saving.value = true;
  try {
    // Only the local-part travels: the API recomposes the source from the
    // route's domain, so an alias can never be moved to another domain here.
    await call(`/domains/${domainId.value}/aliases/${aliasId.value}`, {
      method: "PATCH",
      body: { localPart: form.localPart, destination: form.destination },
    });
    toast.add({ title: t("aliases.editPage.saved"), color: "success" });
    await navigateTo(listPath.value);
  } catch (err) {
    applyServerErrors(err);
    toast.add({ title: t("aliases.editPage.saveFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-info" :title="t('aliases.alertTitle')" />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :to="listPath" size="sm">
      {{ t("aliases.backToList") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold truncate">
          {{ alias ? t("aliases.editPage.title", { source: alias.source }) : t("aliases.editPage.button") }}
        </h2>
      </template>

      <div v-if="loading" class="space-y-4">
        <USkeleton v-for="i in 2" :key="i" class="h-14 w-full" />
      </div>

      <UForm v-else :state="form" class="space-y-4" autocomplete="off" @submit="save">
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

      <div
        v-if="alias && domainId && !isPostmaster && (alias.ownerEmail || canAssignOwner || canUnassignOwner)"
        class="pt-4 mt-4 border-t border-default"
      >
        <MailboxOwnerField
          kind="aliases"
          :domain-id="domainId"
          :resource-id="alias.id"
          :owner-email="alias.ownerEmail"
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
  </div>
</template>
