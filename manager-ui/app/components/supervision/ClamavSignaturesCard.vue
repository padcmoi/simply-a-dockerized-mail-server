<script setup lang="ts">
// How old the signatures the scanner was given are. A virus scanner running on
// last week's set is a scanner that answers every message and catches nothing
// new, and that has no symptom anywhere else on this page: the queue is empty,
// the CPU is idle, everything looks well.
const range = defineModel<MetricRange>("range", { required: true });

const { snapshot, points } = defineProps<{
  snapshot: SystemSnapshot | null;
  points: HistoryPoint[];
  at: number[];
  notice: string;
}>();

const { t } = useI18n();

/** Drawn in hours: a chart of seconds says nothing a reader can hold. */
const series = computed(() => [points.map((point) => (point.clamavAge === null ? null : point.clamavAge / 3600))]);

const values = computed(() => series.value[0] ?? []);
const max = computed(() => metricCeiling(values.value, 1));
const drawable = computed(() => metricKnown(values.value) > 1);

const built = computed(() => snapshot?.clamav?.signaturesAt ?? null);
const live = computed(() => (built.value === null ? null : Math.max(0, (Date.now() - built.value) / 3600000)));

const reachable = computed(() => snapshot?.clamav?.available ?? false);

function hours(value: number) {
  return t("supervision.clamavHours", { n: value.toFixed(1) });
}
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-bug" class="size-4 text-primary" />
            {{ t("supervision.clamav") }}
          </span>
          <span v-if="live !== null" class="text-xs text-dimmed">{{ t("supervision.clamavBuilt", { n: live.toFixed(1) }) }}</span>
          <UBadge v-if="snapshot && !reachable" color="warning" variant="subtle" size="sm" icon="i-lucide-unplug">
            {{ t("supervision.clamavOffline") }}
          </UBadge>
        </div>
        <MetricRanges v-model="range" />
      </div>
    </template>

    <div v-if="built !== null || drawable" class="space-y-4">
      <MetricChart
        v-if="drawable"
        :series="series"
        :max="max"
        :max-label="hours(max)"
        :names="['']"
        :format="hours"
        :at="at"
        :live="range === 'minute'"
        area
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>

    <p v-else class="text-sm text-muted">{{ t("supervision.clamavUnavailable") }}</p>
  </UCard>
</template>
