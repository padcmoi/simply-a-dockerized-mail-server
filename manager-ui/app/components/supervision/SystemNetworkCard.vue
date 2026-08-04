<script setup lang="ts">
import type { HistoryPoint, SystemSnapshot } from "~/composables/useSystemMetrics";
import type { MetricRange } from "~/composables/useMetricWindow";

const range = defineModel<MetricRange>("range", { required: true });

const { snapshot, points } = defineProps<{
  snapshot: SystemSnapshot | null;
  points: HistoryPoint[];
  /** The moment of every point, for the axis. */
  at: number[];
  notice: string;
}>();

const { t } = useI18n();

// Both directions on one pair of axes, so a burst out is read against what came
// in at the same moment, and in two hues rather than two steps of one: they are
// two different things and not one thing at two depths. Points with no rate yet
// are dropped rather than drawn as zero, which would be a dip that never happened.
const series = computed(() => [
  points.map((point) => point.network?.[0] ?? null),
  points.map((point) => point.network?.[1] ?? null),
]);

const max = computed(() => metricCeiling(series.value.flat(), 1000));
const drawable = computed(() => metricKnown(series.value[0] ?? []) > 1);
const live = computed(() => snapshot?.network ?? null);

// The two directions, on the header line next to the title. The arrows go with
// them: "66 kb/s - 170 kb/s" is two numbers and no reading.
const rates = computed(() => {
  const network = live.value;
  return network && network.in !== null && network.out !== null ? { in: network.in, out: network.out } : null;
});

const legend = computed(() => {
  const network = live.value;
  if (!network || network.in === null || network.out === null) return [];

  return [
    `${t("supervision.networkIn")} · ${bitsPerSecond(network.in)}`,
    `${t("supervision.networkOut")} · ${bitsPerSecond(network.out)}`,
  ];
});
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-network" class="size-4 text-primary" />
            {{ t("supervision.network") }}
          </span>
          <span v-if="rates" class="flex items-center gap-1.5 text-xs text-dimmed">
            <UIcon name="i-lucide-arrow-down" class="size-3" />
            {{ bitsPerSecond(rates.in) }}
            <UIcon name="i-lucide-arrow-up" class="ml-1 size-3" />
            {{ bitsPerSecond(rates.out) }}
          </span>
        </div>
        <MetricRanges v-model="range" />
      </div>
    </template>

    <div v-if="live" class="space-y-4">
      <MetricChart
        v-if="drawable"
        :series="series"
        :max="max"
        :max-label="bitsPerSecond(max)"
        :legend="legend"
        :names="[t('supervision.networkIn'), t('supervision.networkOut')]"
        :format="bitsPerSecond"
        variant="series"
        :at="at"
        :now="t('supervision.now')"
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>

    <!-- Only once a frame has actually said so: before the first one there is
         nothing to report, which is not the same as nothing to report from. -->
    <p v-else class="text-sm text-muted">{{ t("supervision.networkUnavailable") }}</p>
  </UCard>
</template>
