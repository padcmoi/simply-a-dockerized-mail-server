<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "create-recipient" },
  ],
});

const MB = 1024 * 1024;
const MIN_QUOTA_MB = 1;
// Mirrors createRecipientSchema's `password: z.string().min(8)`. The API stays
// the authority; this only spares a round-trip and names the rule in place.
const MIN_PASSWORD_LENGTH = 8;
// Mirrors the same schema's local-part regex.
const LOCAL_PART_PATTERN = /^[a-z0-9._+-]+$/i;

const saving = ref(false);

// Field-level refusals the API sent back: an already-taken address, or a value
// the schema rejected. They describe what was submitted, so each is dropped as
// soon as the field it judged is edited (see the watchers below).
const serverErrors = ref<{ localPart?: string; password?: string }>({});

// The quota opens empty rather than on an arbitrary figure: nothing here
// inherits a default, and the only defensible number would be the domain's
// remaining headroom, which is a ceiling, not a suggestion. The hint states
// the admissible range.
const form = reactive({ localPart: "", password: "", quotaMb: null as number | null });

// Clearing a number input hands `v-model.number` back the raw "", not null,
// so every check below reads through this rather than `form.quotaMb`.
const quotaMb = computed(() => (typeof form.quotaMb === "number" && Number.isFinite(form.quotaMb) ? form.quotaMb : null));

// An empty field is neither under nor over the limit, and an untouched one is
// not yet "too short": they show no error, they only keep the submit button
// disabled. Complaining before the user has typed anything is noise.
const quotaUnderLimit = computed(() => quotaMb.value !== null && quotaMb.value < MIN_QUOTA_MB);
const quotaOverLimit = computed(() => quotaMb.value !== null && quotaMb.value > availableMb.value);
const passwordTooShort = computed(() => form.password.length > 0 && form.password.length < MIN_PASSWORD_LENGTH);
const localPartInvalid = computed(() => form.localPart.length > 0 && !LOCAL_PART_PATTERN.test(form.localPart));

// A server refusal disables the button just like a local one: resubmitting the
// exact values the API just rejected can only fail again.
const localPartError = computed(
  () => serverErrors.value.localPart ?? (localPartInvalid.value ? t("recipients.form.localPartInvalid") : undefined)
);
const passwordError = computed(
  () =>
    serverErrors.value.password ??
    (passwordTooShort.value ? t("recipients.form.passwordMin", { value: MIN_PASSWORD_LENGTH }) : undefined)
);

const formInvalid = computed(
  () =>
    !LOCAL_PART_PATTERN.test(form.localPart) ||
    form.password.length < MIN_PASSWORD_LENGTH ||
    quotaMb.value === null ||
    quotaUnderLimit.value ||
    quotaOverLimit.value ||
    Boolean(serverErrors.value.localPart) ||
    Boolean(serverErrors.value.password)
);

// Feeds the donut as the field is typed: an empty or invalid entry claims
// nothing, so the slice collapses instead of jumping to a stale value.
const pendingBytes = computed(() => (quotaMb.value === null ? 0 : quotaMb.value * MB));

// The slider and the number input are two views of `form.quotaMb`, so moving
// either moves the other and redraws the donut. The slider has no way to say
// "no value", hence the fallback to the floor when the field is empty: it
// parks the handle at the left end without writing anything.
const quotaSlider = computed({
  get: () => quotaMb.value ?? MIN_QUOTA_MB,
  set: (value: number) => (form.quotaMb = value),
});

// A domain with nothing left to give would hand the slider a max below its
// min, which reka clamps into an unusable track.
const sliderMax = computed(() => Math.max(MIN_QUOTA_MB, availableMb.value));

const listPath = computed(() => `/admin/domains/${domainFqdn.value}/recipients`);

const { t } = useI18n();
const { call } = useApi();
const { apiErrorBody, apiErrorStatus, apiErrorMessage } = useApiError();
const toast = useToast();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();
const { headroom, availableMb, loadHeadroom } = useRecipientHeadroom(domainId);

// `max` on a number input only bounds the spinner arrows: it constrains
// neither typing nor pasting, so the value is pulled back to the ceiling as it
// changes. The floor is left alone -- clamping it would rewrite a leading "0"
// into "1" mid-keystroke.
//
// The ceiling itself is watched too: when a refreshed headroom comes back
// smaller than what was typed against the old one, the field follows it down
// instead of keeping a value the API would now refuse.
watch([quotaMb, availableMb], ([value, max]) => {
  if (value !== null && value > max) form.quotaMb = max;
});

// Watched per field rather than on `form` as a whole: the clamp above rewrites
// `quotaMb` on its own, and a blanket watcher would read that as the user
// having answered a refusal it knows nothing about.
watch(
  () => form.localPart,
  () => (serverErrors.value.localPart = undefined)
);
watch(
  () => form.password,
  () => (serverErrors.value.password = undefined)
);

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

// Pins the refusal on the field that caused it, so the answer sits where the
// user is looking instead of only in a toast that scrolls away. A 409 is
// always about the address: either it exists already, or it is the reserved
// postmaster@ local-part.
//
// Zod's `issues` locate the offending field, but their text is English and
// generated ("Too small: expected string to have >=8 characters"), so only the
// path is read and the sentence comes from this page's own translations.
function applyServerErrors(err: unknown) {
  if (apiErrorStatus(err) === 409) {
    serverErrors.value.localPart = apiErrorMessage(err);
    return;
  }
  for (const issue of apiErrorBody(err)?.issues ?? []) {
    if (issue.path[0] === "localPart") serverErrors.value.localPart = t("recipients.form.localPartInvalid");
    if (issue.path[0] === "password")
      serverErrors.value.password = t("recipients.form.passwordMin", { value: MIN_PASSWORD_LENGTH });
  }
}

async function create() {
  if (!domainId.value) return;
  const quota = quotaMb.value;
  if (quota === null) return;
  if (quotaUnderLimit.value) {
    toast.add({ title: t("recipients.toast.quotaTooLow", { value: MIN_QUOTA_MB }), color: "error" });
    return;
  }
  if (quotaOverLimit.value) {
    toast.add({ title: t("recipients.form.quotaMax", { value: availableMb.value }), color: "error" });
    return;
  }
  saving.value = true;
  try {
    await call(`/domains/${domainId.value}/recipients`, {
      method: "POST",
      body: {
        localPart: form.localPart,
        password: form.password,
        quota: quota * MB,
      },
    });
    toast.add({ title: t("recipients.toast.created"), color: "success" });
    // Back to the list, which refetches on mount and therefore shows the new
    // recipient and the headroom it just consumed.
    await navigateTo(listPath.value);
  } catch (err) {
    applyServerErrors(err);
    // A 400 on the quota means the domain's headroom shrank since the page
    // loaded, another recipient having been resized meanwhile. Refetch it so
    // the hint, the field's ceiling and the donut state the new truth rather
    // than the stale figure the user typed against.
    await loadHeadroom();
    toast.add({
      title: t("recipients.toast.createFailed"),
      description: apiErrorMessage(err),
      color: "error",
    });
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
                <span class="text-dimmed text-sm truncate">@{{ domainFqdn }}</span>
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
