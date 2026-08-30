<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "create-recipient" },
    { resource: "aliases", action: "access" },
    { resource: "aliases", action: "create-alias" },
  ],
});

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const { set: setBreadcrumb } = useBreadcrumb();
const route = useRoute();
const toast = useToast();
const { domainId, domainFqdn, rows, hasLoadedOnce, refresh } = useDomainDelegations();

const saving = ref(false);
const loadedFor = ref<string | null>(null);
const form = ref<DelegationCapsForm>({
  unlimitedRecipients: false,
  maxRecipients: 5,
  unlimitedAliases: false,
  maxAliases: 5,
  quotaMb: 1024,
  noExpiry: false,
  expiresDays: 7,
});

const accountId = computed(() => String(route.params.accountId));
const basePath = computed(() => `/admin/domains/${domainFqdn.value}/delegations`);
const row = computed(() => rows.value.find((r) => r.accountId === accountId.value) ?? null);
const missing = computed(() => hasLoadedOnce.value && row.value === null);

watch(
  row,
  (r) => {
    if (!r || loadedFor.value === r.accountId) return;
    loadedFor.value = r.accountId;
    form.value = {
      unlimitedRecipients: r.maxRecipients === null,
      maxRecipients: r.maxRecipients ?? 5,
      unlimitedAliases: r.maxAliases === null,
      maxAliases: r.maxAliases ?? 5,
      quotaMb: r.quotaMb,
      noExpiry: false,
      expiresDays: 7,
    };
  },
  { immediate: true }
);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value ?? "...", to: domainFqdn.value ? `/admin/domains/${domainFqdn.value}` : undefined },
    { label: t("domains.delegations.title"), to: basePath.value },
    { label: row.value?.accountEmail ?? t("domains.delegations.edit") },
  ]);
});

async function save() {
  if (!domainId.value || !row.value) return;
  saving.value = true;
  try {
    await call(`/domains/${domainId.value}/delegations/${row.value.accountId}`, {
      method: "PUT",
      body: {
        maxRecipients: form.value.unlimitedRecipients ? null : Math.round(Number(form.value.maxRecipients)),
        maxAliases: form.value.unlimitedAliases ? null : Math.round(Number(form.value.maxAliases)),
        quotaMb: Math.round(Number(form.value.quotaMb)),
      },
    });
    toast.add({ title: t("domains.delegations.saved"), color: "success" });
    await refresh();
    await navigateTo(basePath.value);
  } catch (e) {
    toast.add({ title: t("domains.delegations.saveFailed"), description: apiErrorMessage(e), color: "error" });
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
      icon="i-lucide-pencil"
      :title="t('domains.delegations.edit')"
      :description="row?.accountEmail ?? ''"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :to="basePath">
      {{ t("common.back") }}
    </UButton>

    <UCard>
      <div v-if="!hasLoadedOnce" class="space-y-2">
        <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
      </div>
      <UEmptyState v-else-if="missing" icon="i-lucide-user-x" :title="t('domains.delegations.empty')" />
      <div v-else class="space-y-4">
        <DelegationCapsFields v-model="form" :with-expiry="false" :max-quota-mb="row?.grantableMb" />
        <div class="flex justify-end">
          <UButton :loading="saving" @click="save">{{ t("common.save") }}</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
