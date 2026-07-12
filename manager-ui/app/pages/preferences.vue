<script setup lang="ts">
// Account preferences, all client-side/device-scoped: language and theme (mirror
// the quick toggles in the user menu) plus the shared default table page size
// (LIST_LIMIT_STORAGE_KEY, the same localStorage key every list toolbar reads).
// No permission gate -- available to any authenticated account, like /profile.
definePageMeta({});

const { t, locale, locales, setLocale } = useI18n();
const colorMode = useColorMode();
const { set: setBreadcrumb } = useBreadcrumb();
setBreadcrumb([{ label: t("layout.preferences") }]);

const pageSize = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);

const themeOptions = computed(() => [
  { value: "light", label: t("layout.light"), icon: "i-lucide-sun" },
  { value: "dark", label: t("layout.dark"), icon: "i-lucide-moon" },
  { value: "system", label: t("layout.system"), icon: "i-lucide-monitor" },
]);

const pageSizeOptions = [
  { label: "10", value: 10 },
  { label: "25", value: 25 },
  { label: "50", value: 50 },
];

// A void wrapper: an inline `@click="colorMode.preference = v"` returns the
// assigned string, which Vue's void click handler type rejects.
function setTheme(value: string) {
  colorMode.preference = value;
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      icon="i-lucide-settings"
      :title="t('preferences.title')"
      :description="t('preferences.subtitle')"
      color="neutral"
      variant="subtle"
    />

    <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">{{ t("preferences.language") }}</h2>
    <UCard>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="l in locales"
          :key="l.code"
          icon="i-lucide-globe"
          size="sm"
          :color="locale === l.code ? 'primary' : 'neutral'"
          :variant="locale === l.code ? 'solid' : 'subtle'"
          @click="setLocale(l.code)"
        >
          {{ l.name ?? l.code }}
        </UButton>
      </div>
    </UCard>

    <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">{{ t("preferences.appearance") }}</h2>
    <UCard>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="opt in themeOptions"
          :key="opt.value"
          :icon="opt.icon"
          size="sm"
          :color="colorMode.preference === opt.value ? 'primary' : 'neutral'"
          :variant="colorMode.preference === opt.value ? 'solid' : 'subtle'"
          @click="setTheme(opt.value)"
        >
          {{ opt.label }}
        </UButton>
      </div>
    </UCard>

    <h2 class="font-semibold text-sm text-muted uppercase tracking-wide">{{ t("preferences.pageSize") }}</h2>
    <UCard>
      <USelectMenu v-model="pageSize" value-key="value" :items="pageSizeOptions" class="w-full sm:w-40" />
      <p class="text-sm text-muted mt-2">{{ t("preferences.pageSizeHint") }}</p>
    </UCard>
  </div>
</template>
