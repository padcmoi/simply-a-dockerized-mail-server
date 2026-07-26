<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "invite-account" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("nav.accounts"), to: "/accounts" }, { label: t("accounts.invite.byToken") }]);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-key-round"
      :title="t('accounts.invite.tokenAlertTitle')"
      :description="t('accounts.invite.tokenAlertDescription')"
      color="neutral"
      variant="subtle"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/accounts" size="sm">
      {{ t("accounts.backToList") }}
    </UButton>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("accounts.invite.byToken") }}</h2>
      </template>

      <div class="py-10 text-center space-y-3">
        <UIcon name="i-lucide-construction" class="text-4xl text-muted mx-auto" />
        <p class="font-medium">{{ t("accounts.invite.tokenSoonTitle") }}</p>
        <p class="text-sm text-muted">{{ t("accounts.invite.tokenSoonHint") }}</p>
      </div>
    </UCard>
  </div>
</template>
