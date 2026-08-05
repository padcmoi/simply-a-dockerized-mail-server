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

const { t } = useI18n();

const series = computed(() => [points.map((point) => point.memory)]);
const values = computed(() => series.value[0] ?? []);
const drawable = computed(() => metricKnown(values.value) > 1);

const max = 100;

// The curve is drawn in percent, which is what makes it comparable to itself
// over time, but nobody reads memory in percent: both ends of the scale are
// written in bytes, and the top of the scale is what the host has installed.
function inBytes(percent: number) {
  return preciseBytes((percent / 100) * (snapshot?.memory.total ?? 0));
}

const ratio = computed(() => {
  const memory = snapshot?.memory;
  return memory && memory.total > 0 ? memory.used / memory.total : null;
});

const alert = computed(() => metricAlert(ratio.value, thresholds));
const value = computed(() => (snapshot ? preciseBytes(snapshot.memory.used) : ""));

// The legend carries figures rather than a description: "of what is installed"
// left the reader to go and find what that was, when the two numbers say it.
const legend = computed(() => {
  const memory = snapshot?.memory;
  if (!memory) return [];

  return [`${preciseBytes(memory.used)} ${t("supervision.memoryDetail", { total: preciseBytes(memory.total) })}`];
});
</script>

<template>
  <UCard class="h-full" :class="alert?.ring">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-memory-stick" class="size-4 text-primary" />
            {{ t("supervision.memory") }}
          </span>
          <span v-if="value" class="text-xs text-dimmed">{{ value }}</span>

          <UBadge v-if="alert" :color="alert.color" variant="subtle" size="sm" icon="i-lucide-triangle-alert">
            {{ alert.color === "error" ? t("supervision.memorySaturated") : t("supervision.memoryBusy") }}
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
        :max-label="inBytes(max)"
        :min-label="preciseBytes(0)"
        :legend="legend"
        :names="['']"
        :format="inBytes"
        :at="at"
        :live="range === 'minute'"
        area
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>
  </UCard>
</template>
