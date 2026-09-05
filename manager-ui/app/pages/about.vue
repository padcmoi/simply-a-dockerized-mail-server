<script setup lang="ts">
import { GITHUB_REPO, useCodeVersion } from "~/composables/useCodeVersion";
import { useGithubChangelog, useGithubRelease } from "~/composables/useGithubRelease";
import { linkifyReleaseNotes } from "~/utils/releaseNotes";

definePageMeta({});

const MARKDOWN_CLASS =
  "text-sm leading-relaxed [&_h3]:text-xl [&_h4]:text-lg [&_h4]:mt-6 [&_h4]:border-b [&_h4]:border-default [&_h4]:pb-1 [&_h5]:text-base [&_h5]:mt-4";

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();
const { formatDateTime, timeAgo } = useDateTime();
const { version, pending: versionPending, releaseUrl } = useCodeVersion();
const { lookup, status, rateLimited, refresh } = useGithubRelease(version);
const { changelog, status: changelogStatus, missing: changelogMissing, refresh: reloadChangelog } = useGithubChangelog(version);

const release = computed(() => lookup.value?.release ?? null);
const commit = computed(() => lookup.value?.commit ?? null);
const loading = computed(() => versionPending.value || status.value === "pending");
const failed = computed(() => status.value === "error");
const notes = computed(() => (release.value?.body ? linkifyReleaseNotes(release.value.body, GITHUB_REPO) : ""));
const tagUrl = computed(() => (version.value ? `https://github.com/${GITHUB_REPO}/tree/${version.value}` : null));
const changelogNotes = computed(() => (changelog.value ? linkifyReleaseNotes(changelog.value, GITHUB_REPO) : ""));

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
        :actions="
          tagUrl
            ? [
                {
                  label: t('about.viewTag'),
                  icon: 'i-lucide-external-link',
                  to: tagUrl,
                  target: '_blank',
                  external: true,
                  color: 'neutral',
                  variant: 'outline',
                },
              ]
            : []
        "
      />

      <UCard v-else>
        <template #header>
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
        </template>

        <div :class="MARKDOWN_CLASS">
          <MessageBody v-if="notes" :text="notes" />
          <p v-else class="text-muted">{{ t("about.noNotes") }}</p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center gap-2 min-w-0">
            <UIcon name="i-lucide-scroll-text" class="size-5 shrink-0 text-muted" />
            <h2 class="text-lg font-semibold">{{ t("about.changelog") }}</h2>
            <span class="text-sm text-muted font-mono truncate">CHANGELOG.md</span>
          </div>
        </template>

        <UAlert
          v-if="changelogStatus === 'error'"
          :icon="changelogMissing ? 'i-lucide-file-x' : 'i-lucide-cloud-off'"
          :color="changelogMissing ? 'neutral' : 'error'"
          variant="subtle"
          :title="changelogMissing ? t('about.changelogMissing', { version }) : t('about.loadFailed')"
          :actions="
            changelogMissing
              ? []
              : [
                  {
                    label: t('about.retry'),
                    icon: 'i-lucide-refresh-cw',
                    color: 'neutral',
                    variant: 'outline',
                    onClick: () => reloadChangelog(),
                  },
                ]
          "
        />
        <div v-else-if="changelogNotes" :class="MARKDOWN_CLASS">
          <MessageBody :text="changelogNotes" />
        </div>
        <div v-else class="space-y-3">
          <USkeleton class="h-6 w-48" />
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-5/6" />
          <USkeleton class="h-40 w-full" />
        </div>
      </UCard>
    </template>
  </div>
</template>
