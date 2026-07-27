<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "assign-alias-owner" },
  ],
});

const route = useRoute();
const { t } = useI18n();
const { isRoot, hasGlobal } = usePermissions();
const { set: setBreadcrumb } = useBreadcrumb();

const accountId = computed(() => String(route.params.id));
const backTo = computed(() => `/admin/accounts/${accountId.value}`);
const canAttach = computed(() => isRoot.value || hasGlobal("accounts", "assign-alias-owner"));
const canDetach = computed(() => isRoot.value || hasGlobal("accounts", "unassign-alias-owner"));

watchEffect(() => {
  setBreadcrumb([
    { label: t("nav.accounts"), to: "/admin/accounts" },
    { label: t("accounts.ownership.aliasesTitle"), to: backTo.value },
  ]);
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-share-2"
      :title="t('accounts.ownership.aliasesAlertTitle')"
      :description="t('accounts.ownership.aliasesAlertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :to="backTo" size="sm">
      {{ t("accounts.ownership.backToAccount") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("accounts.ownership.aliasesTitle") }}</h2>
      </template>

      <AccountResourceOwnership :account-id="accountId" kind="aliases" :can-attach="canAttach" :can-detach="canDetach" />
    </UCard>
  </div>
</template>
