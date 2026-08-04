<script setup lang="ts">
import type { HistoryPoint, SystemSnapshot } from "~/composables/useSystemMetrics";
import type { MetricRange } from "~/composables/useMetricWindow";

// The window is the panel's, not this card's: the four of them are read against
// each other, so they cover the same period and the tags set it for all four.
const range = defineModel<MetricRange>("range", { required: true });

const { snapshot, points } = defineProps<{
  snapshot: SystemSnapshot | null;
  /** The curve's points, for whatever window the row is set to. */
  points: HistoryPoint[];
  /** The moment of every point, for the axis. */
  at: number[];
  /** What to say in the space of the chart when there is no chart to draw. */
  notice: string;
}>();

const { t } = useI18n();

// The first frame of a connection carries no percentage, two readings of
// /proc/stat are what makes one, and a recorded window may have moments nothing
// was written for. Both stay null: the point keeps its place on the axis and the
// curve is cut there rather than drawn through a figure nobody measured.
const series = computed(() => [points.map((point) => point.cpu)]);
const values = computed(() => series.value[0] ?? []);
const max = computed(() => Math.min(100, metricCeiling(values.value, 10)));

/** Under two known points there is no line to draw, whatever the window holds. */
const drawable = computed(() => metricKnown(values.value) > 1);

// Everything that is not the curve is on the header line: what the processor is,
// and what it is doing now. A figure that is not known yet drops out of the line
// instead of being stood in for.
const value = computed(() => {
  const parts = [
    snapshot ? t("supervision.cores", { n: snapshot.cores }) : null,
    snapshot?.cpu === undefined || snapshot?.cpu === null ? null : `${snapshot.cpu.toFixed(1)} %`,
  ];

  return parts.filter((part) => part !== null).join(" - ");
});
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-cpu" class="size-4 text-primary" />
            {{ t("supervision.cpu") }}
          </span>
          <span v-if="value" class="text-xs text-dimmed">{{ value }}</span>
        </div>
        <MetricRanges v-model="range" />
      </div>
    </template>

    <div class="space-y-4">
      <MetricChart
        v-if="drawable"
        :series="series"
        :max="max"
        :max-label="`${Math.round(max)} %`"
        :names="['']"
        :format="(value: number) => `${value.toFixed(1)} %`"
        :at="at"
        :now="t('supervision.now')"
        area
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>
  </UCard>
</template>
