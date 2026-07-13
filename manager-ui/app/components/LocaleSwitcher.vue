<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

// Compact flag-based language picker (login screen / top bar). Same tri-state
// as the theme toggle: System + one entry per configured locale, the active
// preference checked. Preferences uses a button row instead (see preferences.vue).
const { t } = useI18n();
const { preference, resolved, options, setPreference, flagFor } = useLocalePreference();

const items = computed<DropdownMenuItem[]>(() =>
  options.value.map((o) => ({
    label: `${o.flag}  ${o.name ?? t("layout.system")}`,
    type: "checkbox" as const,
    checked: preference.value === o.value,
    onUpdateChecked(checked: boolean) {
      if (checked) setPreference(o.value);
    },
    onSelect(e: Event) {
      e.preventDefault();
    },
  }))
);
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton color="neutral" variant="ghost" size="sm" :aria-label="t('app.language')" class="gap-1">
      <span class="text-base leading-none">{{ flagFor(resolved) }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-4 text-dimmed" />
    </UButton>
  </UDropdownMenu>
</template>
