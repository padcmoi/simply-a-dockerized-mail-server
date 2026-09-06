<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";
import { useCodeVersion } from "~/composables/useCodeVersion";

definePageMeta({});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const { version, pending: versionPending, releaseUrl } = useCodeVersion();

// The release and the changelog of the same tag, one tab each: exactly one of
// the two is on screen. The hidden one stays mounted, so what it read from
// GitHub is still there when its tab comes back, with no second call.
const tabs = computed<TabsItem[]>(() => [
  { label: t("about.release"), icon: "i-lucide-rocket", value: "release", slot: "release" },
  { label: t("about.changelog"), icon: "i-lucide-scroll-text", value: "changelog", slot: "changelog" },
]);

watchEffect(() => {
  setBreadcrumb([{ label: version.value ?? t("about.title") }]);
});
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <USkeleton v-if="versionPending" class="h-16 w-full" />
    <UAlert
      v-else
      icon="i-lucide-tag"
      :title="version ?? t('about.unavailable')"
      :description="t('about.subtitle')"
      color="neutral"
      variant="subtle"
      :actions="
        releaseUrl
          ? [
              {
                label: t('about.onGithub'),
                icon: 'i-lucide-external-link',
                to: releaseUrl,
                target: '_blank',
                external: true,
                color: 'neutral',
                variant: 'outline',
              },
            ]
          : []
      "
    />

    <UCard v-if="version">
      <UTabs :items="tabs" default-value="release" :unmount-on-hide="false" :ui="{ content: 'mt-4' }">
        <template #release>
          <AboutReleasePanel :version="version" />
        </template>
        <template #changelog>
          <AboutChangelogPanel :version="version" />
        </template>
      </UTabs>
    </UCard>
  </div>
</template>
