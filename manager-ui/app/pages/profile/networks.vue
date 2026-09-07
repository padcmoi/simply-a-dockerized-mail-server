<script setup lang="ts">
definePageMeta({});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("layout.profile"), to: "/profile" }, { label: t("known.networksTitle") }]);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-network"
      color="neutral"
      variant="subtle"
      :title="t('known.networksAlertTitle')"
      :description="t('known.networksAlertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/profile" size="sm">
      {{ t("profile.backToProfile") }}
    </UButton>

    <SecurityKnownNetworks />
  </div>
</template>
