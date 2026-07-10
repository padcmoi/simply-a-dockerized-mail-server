<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";

definePageMeta({
  requiredGlobal: [
    { resource: "domains", action: "access" },
    { resource: "domains", action: "create" },
  ],
});

const MB = 1024 * 1024;
const MIN_QUOTA_MB = 10;
// Mirrors createDomainSchema's own regex. The API stays the authority; this
// only spares a round-trip and names the rule where the user is typing.
const FQDN_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

const saving = ref(false);

// Field-level refusals the API sent back, dropped as soon as the field they
// judged is edited: they describe what was submitted, not what is now typed.
const serverErrors = ref<{ domain?: string }>({});

// The quota opens empty rather than on an arbitrary figure. The only
// defensible number would be everything the volume has left, which is a
// ceiling, not a suggestion. The hint states the admissible range.
const form = reactive({ domain: "", active: true, quotaMb: null as number | null });

// Clearing a number input hands `v-model.number` back the raw "", not null,
// so every check below reads through this rather than `form.quotaMb`.
const quotaMb = computed(() => (typeof form.quotaMb === "number" && Number.isFinite(form.quotaMb) ? form.quotaMb : null));

// `GET /domains/disk` needs `domains:read`, which an account allowed to create
// a domain need not hold. Without it there is no ceiling to enforce and none
// to draw: the form still works, the API decides.
const hasCapacity = computed(() => assignableMb.value !== null);

// An empty field is neither under nor over the limit, and an untouched FQDN is
// not yet invalid: they show no error, they only keep the button disabled.
const quotaUnderLimit = computed(() => quotaMb.value !== null && quotaMb.value < MIN_QUOTA_MB);
const quotaOverLimit = computed(
  () => quotaMb.value !== null && assignableMb.value !== null && quotaMb.value > assignableMb.value
);
const fqdnInvalid = computed(() => form.domain.length > 0 && !FQDN_PATTERN.test(form.domain));

const domainError = computed(() => serverErrors.value.domain ?? (fqdnInvalid.value ? t("domains.form.fqdnInvalid") : undefined));

const formInvalid = computed(
  () =>
    !FQDN_PATTERN.test(form.domain) ||
    quotaMb.value === null ||
    quotaUnderLimit.value ||
    quotaOverLimit.value ||
    Boolean(serverErrors.value.domain)
);

// Feeds the donut as the field is typed: an empty entry claims nothing, so the
// slice collapses instead of holding a stale value.
const pendingBytes = computed(() => (quotaMb.value === null ? 0 : quotaMb.value * MB));

// Slider and number input are two views of `form.quotaMb`, so moving either
// moves the other and redraws the donut. A slider cannot say "no value", hence
// the fallback to the floor: it parks the handle left without writing.
const quotaSlider = computed({
  get: () => quotaMb.value ?? MIN_QUOTA_MB,
  set: (value: number) => (form.quotaMb = value),
});

// A volume with nothing left would hand the slider a max below its min, which
// reka clamps into an unusable track.
const sliderMax = computed(() => Math.max(MIN_QUOTA_MB, assignableMb.value ?? MIN_QUOTA_MB));

const { t } = useI18n();
const { call } = useApi();
const { apiErrorBody, apiErrorStatus, apiErrorMessage } = useApiError();
const toast = useToast();
const auth = useAuthStore();
const perms = usePermissionsStore();
const domainStore = useDomainStore();
const { set: setBreadcrumb } = useBreadcrumb();
const { disk, diskLoading, assignableMb, loadDisk } = useDomainDisk();

setBreadcrumb([{ label: t("nav.domains"), to: "/domains" }, { label: t("domains.form.title") }]);

// `max` on a number input only bounds the spinner arrows: neither typing nor
// pasting is constrained, so the value is pulled back to the ceiling as it
// changes. The floor is left alone, since clamping it would rewrite a leading
// "0" into "1" mid-keystroke. The ceiling is watched too: a refreshed disk
// read that comes back smaller must drag the field down with it.
watch([quotaMb, assignableMb], ([value, max]) => {
  if (value !== null && max !== null && value > max) form.quotaMb = max;
});

watch(
  () => form.domain,
  () => (serverErrors.value.domain = undefined)
);

// A 409 is always about the name: the domain already exists.
function applyServerErrors(err: unknown) {
  if (apiErrorStatus(err) === 409) {
    serverErrors.value.domain = apiErrorMessage(err);
    return;
  }
  for (const issue of apiErrorBody(err)?.issues ?? []) {
    if (issue.path[0] === "domain") serverErrors.value.domain = t("domains.form.fqdnInvalid");
  }
}

async function create() {
  const quota = quotaMb.value;
  if (quota === null) return;
  if (quotaUnderLimit.value) {
    toast.add({ title: t("domains.toast.quotaTooLow", { value: MIN_QUOTA_MB }), color: "error" });
    return;
  }
  if (quotaOverLimit.value) {
    toast.add({ title: t("domains.toast.quotaTooHigh"), color: "error" });
    return;
  }
  saving.value = true;
  try {
    const created = await call<{ id: number; domain: string; quota: string; active: number }>("/domains", {
      method: "POST",
      body: { domain: form.domain, active: form.active, quota: quota * MB },
    });
    toast.add({ title: t("domains.toast.added"), color: "success" });
    // Straight into the new domain: it is what the user came to build, and the
    // store select is what the sidebar's domain section reads.
    domainStore.select(created);
    await navigateTo(`/domains/${created.domain}`);
  } catch (err) {
    applyServerErrors(err);
    // The volume's free space may have moved since the page loaded (another
    // domain created or resized meanwhile), which is exactly what a 400 on the
    // quota means. Refetch so the hint, the ceiling and the donut agree again.
    if (hasCapacity.value) await loadDisk();
    toast.add({ title: t("domains.toast.addFailed"), description: apiErrorMessage(err), color: "error" });
  } finally {
    saving.value = false;
  }
}

// A create-only account gets a 403 on /domains/disk; asking for it would only
// raise an error toast about a card it is not meant to see.
onMounted(() => {
  if (auth.session?.isRoot === true || perms.hasGlobal("domains", "read")) loadDisk();
});
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('domains.alertTitle')"
      :description="t('domains.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/domains" size="sm">
      {{ t("domains.backToList") }}
    </UButton>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("domains.form.title") }}</h2>
        </template>

        <UForm :state="form" class="space-y-4" autocomplete="off" @submit="create">
          <UFormField :label="t('domains.form.fqdn')" name="domain" :error="domainError">
            <UInput v-model="form.domain" placeholder="example.com" icon="i-lucide-globe" autocomplete="off" class="w-full" />
          </UFormField>

          <UFormField
            :label="t('domains.form.quotaMb')"
            name="quotaMb"
            :error="
              quotaUnderLimit
                ? t('domains.form.quotaMin', { value: MIN_QUOTA_MB })
                : quotaOverLimit
                  ? t('domains.form.quotaMax', { value: assignableMb })
                  : undefined
            "
            :hint="hasCapacity ? t('domains.form.quotaRange', { min: MIN_QUOTA_MB, max: assignableMb }) : undefined"
          >
            <USkeleton v-if="diskLoading" class="h-8 w-full" />
            <div v-else class="space-y-4">
              <UInput
                v-model.number="form.quotaMb"
                type="number"
                :min="MIN_QUOTA_MB"
                :max="assignableMb ?? undefined"
                class="w-full"
              />
              <!-- No slider without a ceiling to slide against. -->
              <USlider v-if="hasCapacity" v-model="quotaSlider" :min="MIN_QUOTA_MB" :max="sliderMax" :step="1" class="px-1" />
            </div>
          </UFormField>

          <UFormField :label="t('domains.form.active')" name="active">
            <USwitch v-model="form.active" />
          </UFormField>
        </UForm>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" to="/domains">{{ t("common.cancel") }}</UButton>
            <UButton icon="i-lucide-plus" :disabled="formInvalid" :loading="saving" @click="create">
              {{ t("domains.form.submit") }}
            </UButton>
          </div>
        </template>
      </UCard>

      <!-- What the quota field's ceiling means, drawn. Absent for an account
           without `domains:read`, which has no capacity figures to show. -->
      <UCard v-if="hasCapacity || diskLoading">
        <template #header>
          <h2 class="font-semibold">{{ t("domains.chart.title") }}</h2>
        </template>

        <div v-if="!disk" class="flex flex-col items-center gap-6">
          <USkeleton class="w-40 h-40 rounded-full" />
          <div class="w-full space-y-2">
            <USkeleton v-for="i in 4" :key="i" class="h-4 w-full" />
          </div>
        </div>
        <DomainCapacityChart v-else :reserved="disk.reservedBytes" :assignable="disk.assignableBytes" :pending="pendingBytes" />
      </UCard>
    </div>
  </div>
</template>
