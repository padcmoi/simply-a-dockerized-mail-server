<script setup lang="ts">
import * as locales from "@nuxt/ui/locale";
import faviconIco from "~/assets/favicon.ico";
import faviconSvg from "~/assets/favicon.svg";
import appleTouchIcon from "~/assets/apple-touch-icon.png";

const UI_LOCALE_MAP: Record<string, keyof typeof locales> = {
  en_GB: "en",
  fr_FR: "fr",
};

const uiLocale = computed(() => locales[UI_LOCALE_MAP[locale.value] ?? "en"]);

const { locale } = useI18n();

useHead({
  link: [
    { rel: "icon", type: "image/x-icon", sizes: "16x16 32x32 48x48", href: faviconIco },
    { rel: "icon", type: "image/svg+xml", href: faviconSvg },
    { rel: "apple-touch-icon", sizes: "180x180", href: appleTouchIcon },
  ],
});
// Wires up both the window-focus and tab-visibility session/permission refresh
// watchers for the whole app lifetime. useSessionRefresh() already calls
// useWindowFocus() internally, so this single call covers both triggers.
useSessionRefresh();
// Periodic data refresh while the window is focused (near real-time), on its own
// composable (single responsibility). Stops when focus is lost; adapts its cadence
// to the connection speed.
useFocusHeartbeat();
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
