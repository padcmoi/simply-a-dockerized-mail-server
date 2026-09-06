<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";
import { useCodeVersion } from "~/composables/useCodeVersion";
import { useGithubTags } from "~/composables/useGithubRelease";

definePageMeta({});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const { version, pending: versionPending, releaseUrl } = useCodeVersion();
const { tags, major, status: tagsStatus } = useGithubTags(version);

// Any tag of the running line can be read here, not only the one answering:
// the select lists them newest first and opens on the newest. Until the list
// is in, or when GitHub will not give it, the running version is what there
// is to show.
const selected = ref<string | undefined>(undefined);
const tagItems = computed(() => {
  const names = tags.value.length ? tags.value : version.value ? [version.value] : [];
  return names.map((name) => ({ label: name, value: name }));
});
const shown = computed(() => selected.value ?? version.value);
const tagsLoading = computed(() => versionPending.value || tagsStatus.value === "pending" || tagsStatus.value === "idle");

// The release and the changelog of the same tag, one tab each: exactly one of
// the two is on screen. The hidden one stays mounted, so what it read from
// GitHub is still there when its tab comes back, with no second call.
const tabs = computed<TabsItem[]>(() => [
  { label: t("about.release"), icon: "i-lucide-rocket", value: "release", slot: "release" },
  { label: t("about.changelog"), icon: "i-lucide-scroll-text", value: "changelog", slot: "changelog" },
]);

watch(
  tags,
  (list) => {
    if (list.length) selected.value = list[0];
  },
  { immediate: true }
);

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

    <template v-if="version">
      <UFormField
        :label="t('about.tagSelect')"
        name="tag"
        :description="major === null ? undefined : t('about.tagSelectHint', { major })"
      >
        <USkeleton v-if="tagsLoading" class="h-8 w-full sm:w-72" />
        <USelect v-else v-model="selected" :items="tagItems" value-key="value" icon="i-lucide-tag" class="w-full sm:w-72" />
      </UFormField>

      <UCard v-if="shown">
        <UTabs :items="tabs" default-value="release" :unmount-on-hide="false" :ui="{ content: 'mt-4' }">
          <template #release>
            <AboutReleasePanel :version="shown" />
          </template>
          <template #changelog>
            <AboutChangelogPanel :version="shown" />
          </template>
        </UTabs>
      </UCard>
    </template>
  </div>
</template>
