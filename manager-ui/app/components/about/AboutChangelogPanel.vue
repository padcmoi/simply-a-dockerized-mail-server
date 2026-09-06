<script setup lang="ts">
// The CHANGELOG.md of the running tag, as the other tab of the About page:
// read raw from GitHub, drawn whole.
import { GITHUB_REPO } from "~/composables/useCodeVersion";
import { useGithubChangelog } from "~/composables/useGithubRelease";
import { RELEASE_MARKDOWN_CLASS, linkifyReleaseNotes } from "~/utils/releaseNotes";

const props = defineProps<{ version: string }>();

const { t } = useI18n();
const { changelog, status, missing, refresh } = useGithubChangelog(toRef(props, "version"));

const notes = computed(() => (changelog.value ? linkifyReleaseNotes(changelog.value, GITHUB_REPO) : ""));
const loading = computed(() => status.value === "pending" || status.value === "idle");
</script>

<template>
  <div v-if="loading" class="space-y-3">
    <USkeleton class="h-6 w-48" />
    <USkeleton class="h-4 w-full" />
    <USkeleton class="h-4 w-5/6" />
    <USkeleton class="h-40 w-full" />
  </div>

  <UAlert
    v-else-if="status === 'error'"
    :icon="missing ? 'i-lucide-file-x' : 'i-lucide-cloud-off'"
    :color="missing ? 'neutral' : 'error'"
    variant="subtle"
    :title="missing ? t('about.changelogMissing', { version }) : t('about.loadFailed')"
    :actions="
      missing
        ? []
        : [
            {
              label: t('about.retry'),
              icon: 'i-lucide-refresh-cw',
              color: 'neutral',
              variant: 'outline',
              onClick: () => refresh(),
            },
          ]
    "
  />

  <div v-else-if="notes" :class="RELEASE_MARKDOWN_CLASS">
    <MessageBody :text="notes" />
  </div>

  <p v-else class="text-muted">{{ t("about.noNotes") }}</p>
</template>
