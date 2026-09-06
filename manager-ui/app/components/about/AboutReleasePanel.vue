<script setup lang="ts">
// The GitHub release of the running tag, as one tab of the About page: what
// GitHub's own release page shows for it, or why it cannot be shown.
import { GITHUB_REPO } from "~/composables/useCodeVersion";
import { useGithubRelease } from "~/composables/useGithubRelease";
import { RELEASE_MARKDOWN_CLASS, linkifyReleaseNotes } from "~/utils/releaseNotes";

const props = defineProps<{ version: string }>();

const { t } = useI18n();
const { formatDateTime, timeAgo } = useDateTime();
const { lookup, status, rateLimited, refresh } = useGithubRelease(toRef(props, "version"));

const release = computed(() => lookup.value?.release ?? null);
const commit = computed(() => lookup.value?.commit ?? null);
const loading = computed(() => status.value === "pending" || status.value === "idle");
const failed = computed(() => status.value === "error");
const notes = computed(() => (release.value?.body ? linkifyReleaseNotes(release.value.body, GITHUB_REPO) : ""));
const tagUrl = computed(() => `https://github.com/${GITHUB_REPO}/tree/${props.version}`);

const badge = computed(() => {
  if (!release.value) return null;
  if (release.value.draft) return { label: t("about.draft"), color: "neutral" as const };
  if (release.value.prerelease) return { label: t("about.preRelease"), color: "warning" as const };
  return { label: t("about.stable"), color: "success" as const };
});

const publishedLine = computed(() => {
  const at = release.value?.published_at;
  if (!at) return t("about.unpublished");
  const ago = timeAgo(at);
  const date = formatDateTime(at);
  return ago ? t("about.publishedAgo", { date, ago }) : t("about.published", { date });
});
</script>

<template>
  <div v-if="loading" class="space-y-3">
    <USkeleton class="h-8 w-56" />
    <USkeleton class="h-4 w-80 max-w-full" />
    <USkeleton class="h-40 w-full" />
  </div>

  <UAlert
    v-else-if="failed"
    icon="i-lucide-cloud-off"
    color="error"
    variant="subtle"
    :title="t('about.loadFailed')"
    :description="rateLimited ? t('about.rateLimited') : undefined"
    :actions="[
      {
        label: t('about.retry'),
        icon: 'i-lucide-refresh-cw',
        color: 'neutral',
        variant: 'outline',
        onClick: () => refresh(),
      },
    ]"
  />

  <UAlert
    v-else-if="!release"
    icon="i-lucide-tag"
    color="neutral"
    variant="subtle"
    :title="t('about.noRelease', { version })"
    :actions="[
      {
        label: t('about.viewTag'),
        icon: 'i-lucide-external-link',
        to: tagUrl,
        target: '_blank',
        external: true,
        color: 'neutral',
        variant: 'outline',
      },
    ]"
  />

  <div v-else class="space-y-4">
    <div>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-2xl font-semibold">{{ release.name || release.tag_name }}</h2>
        <UBadge v-if="badge" :color="badge.color" variant="subtle">{{ badge.label }}</UBadge>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span class="inline-flex items-center gap-1">
          <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
          {{ publishedLine }}
        </span>
        <a
          v-if="release.author"
          :href="release.author.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 hover:text-default"
        >
          <UIcon name="i-lucide-user" class="size-4 shrink-0" />
          {{ release.author.login }}
        </a>
        <span class="inline-flex items-center gap-1">
          <UIcon name="i-lucide-tag" class="size-4 shrink-0" />
          {{ release.tag_name }}
        </span>
        <a
          v-if="commit"
          :href="commit.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-mono hover:text-default"
        >
          <UIcon name="i-lucide-git-commit-horizontal" class="size-4 shrink-0" />
          {{ commit.sha.slice(0, 7) }}
        </a>
      </div>
    </div>

    <USeparator />

    <div :class="RELEASE_MARKDOWN_CLASS">
      <MessageBody v-if="notes" :text="notes" />
      <p v-else class="text-muted">{{ t("about.noNotes") }}</p>
    </div>
  </div>
</template>
