<script setup lang="ts">
definePageMeta({ rootOnly: true });

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.config"), to: "/admin/config" }, { label: t("config.theme.cardTitle") }]);

const { load } = useThemeColors("app");
const { status } = await useAsyncData("app-theme", () => load(), { server: false });
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-palette"
      color="neutral"
      variant="subtle"
      :title="t('config.theme.alertTitle')"
      :description="t('config.theme.alertDescription')"
    />

    <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/admin/config" size="sm">
      {{ t("config.backToConfig") }}
    </UButton>

    <USkeleton v-if="status === 'pending'" class="h-96 w-full rounded-lg" />
    <ThemeColorsCard v-else scope="app" />
  </div>
</template>
