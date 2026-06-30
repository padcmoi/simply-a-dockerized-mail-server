<script setup lang="ts">
import * as locales from "@nuxt/ui/locale";

const UI_LOCALE_MAP: Record<string, keyof typeof locales> = {
  en_EN: "en",
  fr_FR: "fr",
};

const uiLocale = computed(() => locales[UI_LOCALE_MAP[locale.value] ?? "en"]);

const { locale } = useI18n();
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
