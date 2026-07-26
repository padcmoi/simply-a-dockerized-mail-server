<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "assign-recipient-owner" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { isRoot, hasGlobal } = usePermissions();
const { set: setBreadcrumb } = useBreadcrumb();

const accountId = computed(() => String(route.params.id));
const backTo = computed(() => `/accounts/${accountId.value}`);
const canAttach = computed(() => isRoot.value || hasGlobal("accounts", "assign-recipient-owner"));
const canDetach = computed(() => isRoot.value || hasGlobal("accounts", "unassign-recipient-owner"));

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.accounts"), to: "/accounts" },
    { label: t("accounts.ownership.recipientsTitle"), to: backTo.value },
  ]);
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-mailbox"
      :title="t('accounts.ownership.recipientsAlertTitle')"
      :description="t('accounts.ownership.recipientsAlertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :to="backTo" size="sm">
      {{ t("accounts.ownership.backToAccount") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("accounts.ownership.recipientsTitle") }}</h2>
      </template>

      <AccountResourceOwnership :account-id="accountId" kind="recipients" :can-attach="canAttach" :can-detach="canDetach" />
    </UCard>
  </div>
</template>
