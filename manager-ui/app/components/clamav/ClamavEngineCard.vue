<script setup lang="ts">
// What the scanner is, and what it is doing right now. The version it runs is
// read against the one ClamAV publishes: a number alone says nothing about
// whether a newer one exists.
const { status } = defineProps<{ status: ClamavStatus }>();

const { t, locale } = useI18n();

const tag = computed(() => locale.value.replace(/_/g, "-"));

const engine = computed(() => status.engine);
const stats = computed(() => status.stats);

const pools = computed(() =>
  stats.value?.poolsUsed === null || stats.value === null ? null : formatBytes(stats.value.poolsUsed)
);

const built = computed(() =>
  status.signaturesAt === null
    ? null
    : new Date(status.signaturesAt).toLocaleString(tag.value, { dateStyle: "medium", timeStyle: "short" })
);
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-bug" class="size-4 text-primary" />
          {{ t("clamav.engine.title") }}
        </h2>

        <UBadge v-if="status.available" color="success" variant="subtle" size="sm" icon="i-lucide-circle-check">
          {{ t("clamav.engine.online") }}
        </UBadge>
        <UBadge v-else color="warning" variant="subtle" size="sm" icon="i-lucide-unplug">
          {{ t("clamav.engine.offline") }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p class="text-xs text-muted">{{ t("clamav.engine.version") }}</p>
          <p class="font-mono text-lg font-semibold">{{ engine.version ?? t("clamav.engine.unknown") }}</p>
        </div>

        <div>
          <p class="text-xs text-muted">{{ t("clamav.engine.published") }}</p>
          <p class="font-mono text-lg">{{ engine.published ?? t("clamav.engine.unknown") }}</p>
        </div>

        <!-- The figure needs its sentence: a reader counts one thread and takes
             it for a message being scanned, when it is this very request. -->
        <div>
          <UTooltip :text="t('clamav.stats.threadsHint')">
            <p class="flex items-center gap-1 text-xs text-muted">
              {{ t("clamav.stats.threads") }}
              <UIcon name="i-lucide-info" class="size-3" />
            </p>
          </UTooltip>
          <p class="text-lg">
            <template v-if="stats && stats.threadsLive !== null && stats.threadsMax !== null">
              {{ t("clamav.stats.threadsDetail", { live: stats.threadsLive, max: stats.threadsMax }) }}
            </template>
            <template v-else>{{ t("clamav.engine.unknown") }}</template>
          </p>
        </div>

        <div>
          <p class="text-xs text-muted">{{ t("clamav.stats.pools") }}</p>
          <p class="text-lg">{{ pools ?? t("clamav.engine.unknown") }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <UBadge v-if="engine.outdated" color="warning" variant="subtle" size="sm" icon="i-lucide-triangle-alert">
          {{ t("clamav.engine.outdated") }}
        </UBadge>
        <UBadge v-else-if="engine.version && engine.published" color="success" variant="subtle" size="sm" icon="i-lucide-check">
          {{ t("clamav.engine.upToDate") }}
        </UBadge>

        <span v-if="stats && stats.queue !== null" class="text-muted">
          {{ t("clamav.stats.queue") }}: {{ t("clamav.stats.queueDetail", stats.queue) }}
        </span>

        <span v-if="built" class="text-muted">{{ t("clamav.databases.lastBuilt", { at: built }) }}</span>
      </div>

      <p v-if="!status.available" class="text-sm text-muted">{{ t("clamav.engine.offlineHint") }}</p>
    </div>
  </UCard>
</template>
