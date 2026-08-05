<script setup lang="ts">
import type { HistoryPoint, SystemSnapshot } from "~/composables/useSystemMetrics";
import type { MetricRange } from "~/composables/useMetricWindow";

const range = defineModel<MetricRange>("range", { required: true });

const { snapshot, points, thresholds } = defineProps<{
  snapshot: SystemSnapshot | null;
  points: HistoryPoint[];
  /** The moment of every point, for the axis. */
  at: number[];
  notice: string;
  /** The API's own, so the outline is drawn on the figure it notifies about. */
  thresholds: MetricThresholds;
}>();

const WINDOWS = ["1 min", "5 min", "15 min"];

const { t } = useI18n();

// A moment nothing was recorded for stays null in all three: the point keeps its
// place on the time axis and the curves are cut there together.
const series = computed(() => [
  points.map((point) => point.load?.[0] ?? null),
  points.map((point) => point.load?.[1] ?? null),
  points.map((point) => point.load?.[2] ?? null),
]);

// A load average has no ceiling of its own, so the box is fitted to the window
// with a quarter of the core count as a floor.
const max = computed(() => metricCeiling(series.value.flat(), 0.25));
const drawable = computed(() => metricKnown(series.value[0] ?? []) > 1);

// Still read per core, which is what decides the badge, but no longer written
// out: the same figure is on the CPU card next to the core count that gives it
// its meaning, and saying it twice on one screen made the header a sentence.
const ratio = computed(() => (snapshot && snapshot.cores > 0 ? snapshot.load.one / snapshot.cores : null));
const alert = computed(() => metricAlert(ratio.value, thresholds));

const value = computed(() => (snapshot ? snapshot.load.one.toFixed(2) : ""));

// The legend carries each curve's own figure, so the three windows are told
// apart by a name and a number and never by their shade alone.
const legend = computed(() => {
  const load = snapshot?.load;
  if (!load) return [];

  return [
    `${load.one.toFixed(2)} · ${WINDOWS[0]}`,
    `${load.five.toFixed(2)} · ${WINDOWS[1]}`,
    `${load.fifteen.toFixed(2)} · ${WINDOWS[2]}`,
  ];
});
</script>

<template>
  <UCard class="h-full" :class="alert?.ring">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-gauge" class="size-4 text-primary" />
            {{ t("supervision.load") }}
          </span>
          <span v-if="value" class="text-xs text-dimmed">{{ value }}</span>

          <!-- A colour is not a statement: what turned the card is named here,
               at the top, where it is read before the curve rather than after. -->
          <UBadge v-if="alert" :color="alert.color" variant="subtle" size="sm" icon="i-lucide-triangle-alert">
            {{ alert.color === "error" ? t("supervision.loadSaturated") : t("supervision.loadBusy") }}
          </UBadge>
        </div>
        <MetricRanges v-model="range" />
      </div>
    </template>

    <div class="space-y-4">
      <MetricChart
        v-if="drawable"
        :series="series"
        :max="max"
        :max-label="max.toFixed(2)"
        :legend="legend"
        :names="WINDOWS"
        :format="(value: number) => value.toFixed(2)"
        variant="series"
        :at="at"
        :live="range === 'minute'"
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>
  </UCard>
</template>
