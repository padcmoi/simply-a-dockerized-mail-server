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
const { domainId, domainFqdn, grantableMb, refresh } = useDomainDelegations();
const { set: setBreadcrumb } = useBreadcrumb();
const route = useRoute();
const toast = useToast();

const mode = ref<"invite" | "token">(route.query.type === "token" ? "token" : "invite");
const email = ref("");
const note = ref("");
const saving = ref(false);
const createdLink = ref<string | null>(null);
// The two ceilings open at zero rather than at a figure nobody chose: a grant
// is what its author decides to give, and five mailboxes handed out by default
// is five mailboxes nobody asked for.
const form = ref<DelegationCapsForm>({
  unlimitedRecipients: false,
  maxRecipients: 0,
  unlimitedAliases: false,
  maxAliases: 0,
  quotaMb: 1024,
  noExpiry: false,
  expiresDays: 7,
});

const basePath = computed(() => `/admin/domains/${domainFqdn.value}/delegations`);
const emailValid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()));
const canSubmit = computed(() => (mode.value === "token" ? true : emailValid.value));
const modeItems = computed(() => [
  { label: t("domains.delegations.modeInvite"), value: "invite" },
  { label: t("domains.delegations.modeToken"), value: "token" },
]);

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.domains"), to: "/admin/domains" },
    { label: domainFqdn.value ?? "...", to: domainFqdn.value ? `/admin/domains/${domainFqdn.value}` : undefined },
    { label: t("domains.delegations.title"), to: basePath.value },
    { label: t("domains.delegations.createTitle") },
  ]);
});

function body() {
  return {
    maxRecipients: form.value.unlimitedRecipients ? null : Math.round(Number(form.value.maxRecipients)),
    maxAliases: form.value.unlimitedAliases ? null : Math.round(Number(form.value.maxAliases)),
    quotaMb: Math.round(Number(form.value.quotaMb)),
    expiresDays: form.value.noExpiry ? null : Math.round(Number(form.value.expiresDays)),
  };
}

async function submit() {
  if (!domainId.value) return;
  saving.value = true;
  try {
    if (mode.value === "token") {
      const res = await call<{ link: string }>(`/domains/${domainId.value}/delegations/token`, {
        method: "POST",
        body: { ...body(), note: note.value.trim().slice(0, 30) || null },
      });
      createdLink.value = res.link;
      toast.add({ title: t("domains.delegations.tokenCreatedTitle"), color: "success" });
      await refresh();
    } else {
      const res = await call<{ mode: "granted" | "invited" }>(`/domains/${domainId.value}/delegations/invite`, {
        method: "POST",
        body: { email: email.value.trim().toLowerCase(), ...body() },
      });
      toast.add({
        title: res.mode === "granted" ? t("domains.delegations.granted") : t("domains.delegations.invited"),
        color: "success",
      });
      await refresh();
      await navigateTo(basePath.value);
    }
  } catch (e) {
    toast.add({ title: t("domains.delegations.saveFailed"), description: apiErrorMessage(e), color: "error" });
  } finally {
    saving.value = false;
  }
}

async function copyLink() {
  if (!createdLink.value) return;
  await navigator.clipboard.writeText(createdLink.value);
  toast.add({ title: t("domains.delegations.copied"), icon: "i-lucide-copy", color: "success", duration: 1500 });
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-user-plus"
      :title="t('domains.delegations.createTitle')"
      :description="t('domains.delegations.subtitle')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :to="basePath">
      {{ t("common.back") }}
    </UButton>

    <UCard>
      <div v-if="createdLink" class="space-y-3">
        <p class="font-medium">{{ t("domains.delegations.tokenCreatedTitle") }}</p>
        <p class="text-xs text-muted">{{ t("domains.delegations.tokenCreatedHint") }}</p>
        <div class="flex items-center gap-2">
          <UInput :model-value="createdLink" readonly class="flex-1 min-w-0" />
          <UButton icon="i-lucide-copy" color="neutral" variant="soft" @click="copyLink">
            {{ t("domains.delegations.copyLink") }}
          </UButton>
        </div>
        <UButton color="neutral" variant="soft" :to="`${basePath}/invitations`">
          {{ t("domains.delegations.showInvitations") }}
        </UButton>
      </div>

      <div v-else class="space-y-4">
        <UFormField :label="t('domains.delegations.modeLabel')">
          <URadioGroup v-model="mode" :items="modeItems" orientation="horizontal" />
        </UFormField>

        <UFormField
          v-if="mode === 'invite'"
          :label="t('domains.delegations.email')"
          :description="t('domains.delegations.emailHint')"
          required
        >
          <UInput v-model="email" class="w-full" :placeholder="t('domains.delegations.emailPlaceholder')" />
        </UFormField>
        <template v-else>
          <p class="text-xs text-muted">{{ t("domains.delegations.tokenCreatedHint") }}</p>
          <UFormField :label="t('domains.delegations.noteLabel')" :description="t('domains.delegations.noteHint')">
            <UInput v-model="note" maxlength="30" class="w-full" :placeholder="t('domains.delegations.notePlaceholder')" />
          </UFormField>
        </template>

        <DelegationCapsFields v-model="form" :with-expiry="true" :max-quota-mb="grantableMb" />

        <div class="flex justify-end">
          <UButton :loading="saving" :disabled="!canSubmit" @click="submit">
            {{ mode === "token" ? t("domains.delegations.createToken") : t("domains.delegations.invite") }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
