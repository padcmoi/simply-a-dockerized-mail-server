<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "edit-recipient" },
  ],
});

interface Recipient {
  id: number;
  email: string;
  quota: string;
  usedBytes: string;
  active: number;
}

const MB = 1024 * 1024;
const MIN_QUOTA_MB = 1;

const recipient = ref<Recipient | null>(null);
const loading = ref(true);
const saving = ref(false);

const form = reactive({ active: true, quotaMb: MIN_QUOTA_MB });

const route = useRoute();
const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const toast = useToast();
const { domainId, domainFqdn } = useCurrentDomain();
const { set: setBreadcrumb } = useBreadcrumb();
const { availableMb, loadHeadroom } = useRecipientHeadroom(domainId);

const recipientId = computed(() => Number(route.params.id));
const listPath = computed(() => `/domains/${domainFqdn.value}/recipients`);

// Shrinking below what the mailbox already stores would put it instantly over
// quota and dovecot would bounce its mail, so its usage is the real floor.
// Rounded up: 1.4 MB stored means 2 MB is the smallest quota that still fits.
// The API refuses it too (recipients.quotaBelowUsage); blocking it here is the
// preventive half, so the field never offers a value the save would reject.
const usedMb = computed(() => (recipient.value ? Math.ceil(Number(recipient.value.usedBytes) / MB) : MIN_QUOTA_MB));
const floorMb = computed(() => Math.max(MIN_QUOTA_MB, usedMb.value));

// Resizing frees the recipient's own reservation first, so its ceiling is the
// domain's remaining headroom plus what it already holds.
const currentMb = computed(() => (recipient.value ? Math.floor(Number(recipient.value.quota) / MB) : 0));
const maxQuotaMb = computed(() => Math.max(MIN_QUOTA_MB, availableMb.value + currentMb.value));

// A mailbox whose usage has grown past the domain's remaining headroom would
// hand the slider a max below its min, which reka clamps into an unusable
// track. The number field keeps reporting the real bounds either way.
const sliderMax = computed(() => Math.max(floorMb.value, maxQuotaMb.value));

const quotaUnderLimit = computed(() => form.quotaMb < floorMb.value);
const quotaOverLimit = computed(() => form.quotaMb > maxQuotaMb.value);

// Nothing to save until something actually differs from what was loaded.
const dirty = computed(
  () => recipient.value !== null && (form.active !== (recipient.value.active === 1) || form.quotaMb !== currentMb.value)
);

const formInvalid = computed(() => quotaUnderLimit.value || quotaOverLimit.value || !dirty.value);

watch(domainId, load, { immediate: true });

// `max` on a number input only bounds the spinner arrows: typing or pasting
// walks straight past it, so the value is pulled back to the ceiling as it
// changes. `maxQuotaMb` tracks the domain's headroom, which shrinks whenever
// another recipient is resized, and the field must follow it down.
watch([() => form.quotaMb, maxQuotaMb], ([value, max]) => {
  if (Number.isFinite(value) && value > max) form.quotaMb = max;
});

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/domains" },
    { label: domainFqdn.value, to: `/domains/${domainFqdn.value}` },
    { label: t("nav.recipients"), to: listPath.value },
    { label: recipient.value?.email ?? "..." },
    { label: t("recipients.editPage.button") },
  ]);
});

async function load() {
  if (!domainId.value) return;
  loading.value = true;
  try {
    const found = await call<Recipient>(`/domains/${domainId.value}/recipients/${recipientId.value}`);
    recipient.value = found;
    form.active = found.active === 1;
    // An existing quota can sit below the floor (usage grew past it, or the
    // mailbox predates this rule); open on the floor so the field starts valid.
    form.quotaMb = Math.max(Math.round(Number(found.quota) / MB), floorMb.value);
  } catch (err) {
    toast.add({ title: t("recipients.editPage.loadFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!domainId.value || formInvalid.value) return;
  saving.value = true;
  try {
    await call(`/domains/${domainId.value}/recipients/${recipientId.value}`, {
      method: "PATCH",
      body: { quota: form.quotaMb * MB, active: form.active },
    });
    await loadHeadroom();
    toast.add({ title: t("recipients.editPage.saved"), color: "success" });
    await navigateTo(listPath.value);
  } catch (err) {
    toast.add({ title: t("recipients.editPage.saveFailed"), description: apiErrorMessage(err), color: "error" });
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
