<script setup lang="ts">
definePageMeta({
  requiredDomain: [
    { resource: "recipients", action: "access" },
    { resource: "recipients", action: "create-recipient" },
    { resource: "aliases", action: "access" },
    { resource: "aliases", action: "create-alias" },
  ],
});

const DAY_MS = 24 * 3600 * 1000;

const { t } = useI18n();
const { call } = useApi();
const { apiErrorMessage } = useApiError();
const { set: setBreadcrumb } = useBreadcrumb();
const route = useRoute();
const toast = useToast();
const { domainId, domainFqdn, pending, hasLoadedOnce, refresh } = useDomainDelegations();

const saving = ref(false);
const loadedFor = ref<number | null>(null);
const note = ref("");
const form = ref<DelegationCapsForm>({
  unlimitedRecipients: false,
  maxRecipients: 0,
  unlimitedAliases: false,
  maxAliases: 0,
  quotaMb: 1024,
  noExpiry: false,
  expiresDays: 7,
});

const invitationId = computed(() => Number(route.params.id));
const basePath = computed(() => `/admin/domains/${domainFqdn.value}/delegations`);
const row = computed(() => pending.value.find((p) => p.id === invitationId.value) ?? null);
const missing = computed(() => hasLoadedOnce.value && row.value === null);

watch(
  row,
  (r) => {
    if (!r || loadedFor.value === r.id) return;
    loadedFor.value = r.id;
    note.value = r.note ?? "";
    const remainingDays =
      r.expiresAt === null ? 7 : Math.max(1, Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / DAY_MS));
    form.value = {
      unlimitedRecipients: r.maxRecipients === null,
      maxRecipients: r.maxRecipients ?? 0,
      unlimitedAliases: r.maxAliases === null,
      maxAliases: r.maxAliases ?? 0,
      quotaMb: r.quotaMb,
      noExpiry: r.expiresAt === null,
      expiresDays: remainingDays,
    };
  },
  { immediate: true }
);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value ?? "...", to: domainFqdn.value ? `/admin/domains/${domainFqdn.value}` : undefined },
    { label: t("domains.delegations.title"), to: basePath.value },
    { label: t("domains.delegations.pendingTitle"), to: `${basePath.value}/invitations` },
    { label: row.value?.email ?? row.value?.note ?? t("domains.delegations.tokenBadge") },
  ]);
});

async function save() {
  if (!domainId.value || !row.value) return;
  saving.value = true;
  try {
    await call(`/domains/${domainId.value}/delegations/invitations/${row.value.id}`, {
      method: "PUT",
      body: {
        maxRecipients: form.value.unlimitedRecipients ? null : Math.round(Number(form.value.maxRecipients)),
        maxAliases: form.value.unlimitedAliases ? null : Math.round(Number(form.value.maxAliases)),
        quotaMb: Math.round(Number(form.value.quotaMb)),
        expiresDays: form.value.noExpiry ? null : Math.round(Number(form.value.expiresDays)),
        note: note.value.trim().slice(0, 30) || null,
      },
    });
    toast.add({ title: t("domains.delegations.saved"), color: "success" });
    await refresh();
    await navigateTo(`${basePath.value}/invitations`);
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
      :title="t('domains.delegations.editInviteTitle')"
      :description="row?.email ?? row?.note ?? t('domains.delegations.tokenBadge')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :to="`${basePath}/invitations`">
      {{ t("common.back") }}
    </UButton>

    <UCard>
      <div v-if="!hasLoadedOnce" class="space-y-2">
        <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
      </div>
      <UEmptyState v-else-if="missing" icon="i-lucide-hourglass" :title="t('domains.delegations.pendingEmpty')" />
      <div v-else class="space-y-4">
        <UFormField
          v-if="row && row.email === null"
          :label="t('domains.delegations.noteLabel')"
          :description="t('domains.delegations.noteHint')"
        >
          <UInput v-model="note" maxlength="30" class="w-full" :placeholder="t('domains.delegations.notePlaceholder')" />
        </UFormField>
        <DelegationCapsFields v-model="form" :with-expiry="true" :max-quota-mb="row?.grantableMb" />
        <div class="flex justify-end">
          <UButton :loading="saving" @click="save">{{ t("common.save") }}</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
