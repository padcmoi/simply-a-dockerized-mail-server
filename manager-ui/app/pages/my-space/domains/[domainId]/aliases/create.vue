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
const form = reactive({ localPart: "", destination: "" });

const domainId = computed(() => Number(route.params.domainId));
const delegation = computed(() => rows.value.find((d) => d.domainId === domainId.value) ?? null);
const missing = computed(() => hasLoadedOnce.value && delegation.value === null);
const capReached = computed(
  () => !!delegation.value && delegation.value.maxAliases !== null && delegation.value.usedAliases >= delegation.value.maxAliases
);
const localPartValid = computed(() => /^[a-z0-9._+-]+$/i.test(form.localPart.trim()));
const destinationValid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.destination.trim()));
const canSubmit = computed(() => !!delegation.value && !capReached.value && localPartValid.value && destinationValid.value);

watchEffect(() => {
  setBreadcrumb([{ label: t("nav.myspace"), to: "/my-space" }, { label: t("myspace.delegations.newAlias") }]);
});

async function submit() {
  const d = delegation.value;
  if (!d) return;
  saving.value = true;
  try {
    await call(`/my-space/domains/${d.domainId}/aliases`, {
      method: "POST",
      body: { localPart: form.localPart.trim().toLowerCase(), destination: form.destination.trim().toLowerCase() },
    });
    toast.add({ title: t("myspace.delegations.createdAlias"), color: "success" });
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
      icon="i-lucide-at-sign"
      :title="t('myspace.delegations.createAliasTitle', { domain: delegation?.domain ?? '...' })"
      :description="t('myspace.delegations.subtitle')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" to="/my-space">
      {{ t("common.back") }}
    </UButton>

    <UCard>
      <div v-if="!hasLoadedOnce" class="space-y-2">
        <USkeleton v-for="i in 2" :key="i" class="h-10 w-full" />
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

        <UFormField :label="t('myspace.delegations.destination')" required>
          <UInput v-model="form.destination" class="w-full" :placeholder="t('myspace.delegations.destinationPlaceholder')" />
        </UFormField>

        <div class="flex justify-end">
          <UButton :loading="saving" :disabled="!canSubmit" @click="submit">{{ t("myspace.delegations.create") }}</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
