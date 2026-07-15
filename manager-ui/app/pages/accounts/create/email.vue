<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "invite-account" },
  ],
});

interface DomainOption {
  id: number;
  domain: string;
  ownerEmail: string | null;
}

const { t } = useI18n();
const { call } = useApi();
const toast = useToast();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.accounts"), to: "/accounts" }, { label: t("accounts.invite.byEmail") }]);

const { groups, load: loadGroups } = useGroups();
const { isRoot, hasGlobal } = usePermissions();

const email = ref("");
const domainId = ref<number | undefined>(undefined);
const selectedGroupIds = ref<string[]>([]);
const makeOwner = ref(false);
const ownerConfirmOpen = ref(false);
const domains = ref<DomainOption[]>([]);
const sending = ref(false);

const domainOptions = computed(() => domains.value.map((d) => ({ label: d.domain, value: d.id })));
const groupOptions = computed(() => groups.value.filter((g) => !g.isDefault).map((g) => ({ label: g.name, value: g.id })));
const selectedDomain = computed(() => domains.value.find((d) => d.id === domainId.value) ?? null);
const currentOwnerEmail = computed(() => selectedDomain.value?.ownerEmail ?? null);
// Designating an owner takes the same three global actions the API enforces on
// acceptance: the switch stays visible but is locked when any is missing.
const canMakeOwner = computed(
  () =>
    isRoot.value ||
    (hasGlobal("accounts", "set-domain-owner") &&
      hasGlobal("domains", "transfer-domain-ownership") &&
      hasGlobal("domain_owner_elevated", "transfer-domain-ownership"))
);
const canSubmit = computed(() => /.+@.+\..+/.test(email.value) && domainId.value !== undefined);

watch(domainId, () => {
  makeOwner.value = false;
});

// Turning the switch ON is the sensitive move: it only takes effect once the
// invitee accepts, so we confirm the deferred transfer before staging it.
// Turning it OFF needs no confirmation.
function onToggleOwner(value: boolean) {
  if (value) ownerConfirmOpen.value = true;
  else makeOwner.value = false;
}

function confirmOwner() {
  makeOwner.value = true;
}

async function loadDomains() {
  try {
    const res = await call<{ items: DomainOption[]; total: number }>("/domains?limit=50&page=1");
    domains.value = res.items;
  } catch (e) {
    toast.add({ title: t("accounts.invite.domainsLoadFailed"), description: (e as Error).message, color: "error" });
  }
}

async function submit() {
  if (!canSubmit.value) return;
  sending.value = true;
  try {
    await call("/accounts/invite", {
      method: "POST",
      body: {
        email: email.value,
        domainId: domainId.value,
        groupIds: selectedGroupIds.value,
        makeOwner: makeOwner.value,
      },
    });
    toast.add({ title: t("accounts.toast.invited"), color: "success" });
    navigateTo("/accounts");
  } catch (e) {
    toast.add({ title: t("accounts.toast.inviteFailed"), description: (e as Error).message, color: "error" });
  } finally {
    sending.value = false;
  }
}

onMounted(() => {
  loadDomains();
  loadGroups();
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-mail"
      :title="t('accounts.invite.emailAlertTitle')"
      :description="t('accounts.invite.emailAlertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/accounts" size="sm">
      {{ t("accounts.backToList") }}
    </UButton>

    <form class="space-y-6" @submit.prevent="submit">
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t("accounts.invite.byEmail") }}</h2>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <UFormField :label="t('accounts.invite.emailLabel')" required>
            <UInput
              v-model="email"
              type="email"
              icon="i-lucide-mail"
              placeholder="jane@example.com"
              autocomplete="off"
              class="w-full"
              required
            />
          </UFormField>

          <UFormField :label="t('accounts.invite.domainLabel')" required>
            <USelectMenu
              v-model="domainId"
              value-key="value"
              icon="i-lucide-globe"
              :items="domainOptions"
              :placeholder="t('accounts.invite.domainPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('accounts.invite.groupsLabel')" class="sm:col-span-2">
            <USelectMenu
              v-model="selectedGroupIds"
              multiple
              value-key="value"
              icon="i-lucide-users-round"
              :items="groupOptions"
              :placeholder="t('accounts.invite.groupsPlaceholder')"
              class="w-full"
            />
            <p class="text-xs text-muted mt-1.5">{{ t("accounts.invite.groupsHint") }}</p>
          </UFormField>
        </div>
      </UCard>

      <UCard v-if="domainId !== undefined">
        <template #header>
          <h2 class="font-semibold flex items-center gap-1.5">
            <UIcon name="i-lucide-crown" class="size-4 text-muted" />
            {{ t("accounts.invite.ownerSectionTitle") }}
          </h2>
        </template>

        <div class="space-y-4">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-muted">{{ t("accounts.invite.currentOwnerLabel") }}</span>
            <UBadge v-if="currentOwnerEmail" color="neutral" variant="subtle">{{ currentOwnerEmail }}</UBadge>
            <span v-else class="text-muted italic">{{ t("accounts.invite.noOwner") }}</span>
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ t("accounts.invite.makeOwnerLabel") }}</p>
              <p class="text-xs text-muted mt-0.5">{{ t("accounts.invite.makeOwnerHint") }}</p>
              <p v-if="!canMakeOwner" class="text-xs text-warning mt-1 flex items-center gap-1">
                <UIcon name="i-lucide-lock" class="size-3.5 shrink-0" />
                {{ t("accounts.invite.makeOwnerNoRight") }}
              </p>
            </div>
            <USwitch :model-value="makeOwner" :disabled="!canMakeOwner" @update:model-value="onToggleOwner" />
          </div>
        </div>
      </UCard>

      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" to="/accounts">{{ t("common.cancel") }}</UButton>
        <UButton type="submit" color="primary" icon="i-lucide-send" :loading="sending" :disabled="!canSubmit">
          {{ t("accounts.invite.submit") }}
        </UButton>
      </div>
    </form>

    <ConfirmModal
      v-model:open="ownerConfirmOpen"
      type="warning"
      :title="t('accounts.invite.makeOwnerConfirmTitle')"
      :description="t('accounts.invite.makeOwnerConfirmDescription')"
      @confirm="confirmOwner"
    />
  </div>
</template>
