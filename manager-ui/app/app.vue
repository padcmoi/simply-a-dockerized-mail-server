<script setup lang="ts">
import * as locales from "@nuxt/ui/locale";

const UI_LOCALE_MAP: Record<string, keyof typeof locales> = {
  en_EN: "en",
  fr_FR: "fr",
};

const uiLocale = computed(() => locales[UI_LOCALE_MAP[locale.value] ?? "en"]);

const { locale } = useI18n();
// Wires up both the window-focus and tab-visibility session/permission refresh
// watchers for the whole app lifetime — useSessionRefresh() already calls
// useWindowFocus() internally, so this single call covers both triggers.
useSessionRefresh();
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
