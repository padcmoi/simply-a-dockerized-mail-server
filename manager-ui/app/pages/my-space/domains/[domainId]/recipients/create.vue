<script setup lang="ts">
definePageMeta({});

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const { set: setBreadcrumb } = useBreadcrumb();
const { bump } = useDataRefresh();
const route = useRoute();
const toast = useToast();
const { rows, hasLoadedOnce, refresh } = useMyDelegations();

const saving = ref(false);
const loadedFor = ref<number | null>(null);
const form = reactive({ localPart: "", password: "", quotaMb: 100 });

const domainId = computed(() => Number(route.params.domainId));
const delegation = computed(() => rows.value.find((d) => d.domainId === domainId.value) ?? null);
const missing = computed(() => hasLoadedOnce.value && delegation.value === null);
const remainingQuotaMb = computed(() =>
  delegation.value ? Math.max(0, delegation.value.quotaMb - Math.round(Number(delegation.value.usedBytes) / MB)) : 0
);
const quotaPercent = computed(() =>
  remainingQuotaMb.value > 0 ? Math.min(100, Math.round((Number(form.quotaMb) / remainingQuotaMb.value) * 100)) : 0
);
const capReached = computed(
  () =>
    !!delegation.value &&
    delegation.value.maxRecipients !== null &&
    delegation.value.usedRecipients >= delegation.value.maxRecipients
);
const localPartValid = computed(() => /^[a-z0-9._+-]+$/i.test(form.localPart.trim()));
const canSubmit = computed(
  () => !!delegation.value && !capReached.value && localPartValid.value && form.password.length >= 8 && Number(form.quotaMb) >= 1
);

watch(
  delegation,
  (d) => {
    if (!d || loadedFor.value === d.domainId) return;
    loadedFor.value = d.domainId;
    form.quotaMb = Math.min(100, Math.max(1, remainingQuotaMb.value));
  },
  { immediate: true }
);

watch(
  [() => form.quotaMb, remainingQuotaMb],
  () => {
    if (delegation.value && Number(form.quotaMb) > remainingQuotaMb.value) form.quotaMb = remainingQuotaMb.value;
  },
  { immediate: true }
);

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.myspace"), to: "/my-space" }, { label: t("myspace.delegations.newRecipient") }]);
});

async function submit() {
  const d = delegation.value;
  if (!d) return;
  saving.value = true;
  try {
    await call(`/my-space/domains/${d.domainId}/recipients`, {
      method: "POST",
      body: {
        localPart: form.localPart.trim().toLowerCase(),
        password: form.password,
        quota: Math.round(Number(form.quotaMb)) * MB,
      },
    });
    toast.add({ title: t("myspace.delegations.createdRecipient"), color: "success" });
    bump();
    await refresh();
    await navigateTo("/my-space?tab=delegations");
  } catch (e) {
    toast.add({ title: t("myspace.delegations.createFailed"), description: apiErrorMessage(e), color: "error" });
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
      icon="i-lucide-mail-plus"
      :title="t('myspace.delegations.createRecipientTitle', { domain: delegation?.domain ?? '...' })"
      :description="t('myspace.delegations.subtitle')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" to="/my-space">
      {{ t("common.back") }}
    </UButton>

    <UCard>
      <div v-if="!hasLoadedOnce" class="space-y-2">
        <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
      </div>
      <UEmptyState v-else-if="missing" icon="i-lucide-user-x" :title="t('myspace.delegations.missing')" />
      <div v-else class="space-y-4">
        <UFormField :label="t('myspace.delegations.localPart')" required>
          <div class="flex items-center gap-2">
            <UInput
              v-model="form.localPart"
              class="flex-1 min-w-0"
              :placeholder="t('myspace.delegations.localPartPlaceholder')"
            />
            <span class="text-sm text-muted shrink-0">{{ "@" + (delegation?.domain ?? "") }}</span>
          </div>
        </UFormField>

        <UFormField :label="t('myspace.delegations.password')" required>
          <UInput
            v-model="form.password"
            type="password"
            class="w-full"
            :placeholder="t('myspace.delegations.passwordPlaceholder')"
          />
        </UFormField>

        <div class="space-y-2">
          <UFormField :label="t('myspace.delegations.quotaMb')" :description="t('myspace.delegations.quotaHint')" required>
            <UInput v-model.number="form.quotaMb" type="number" min="1" :max="remainingQuotaMb" class="w-full" />
          </UFormField>
          <UProgress :model-value="quotaPercent" size="sm" />
          <p class="text-xs text-muted">
            {{ t("myspace.delegations.quotaAvailable", { used: Math.round(Number(form.quotaMb) || 0), max: remainingQuotaMb }) }}
          </p>
        </div>

        <div class="flex justify-end">
          <UButton :loading="saving" :disabled="!canSubmit" @click="submit">{{ t("myspace.delegations.create") }}</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
