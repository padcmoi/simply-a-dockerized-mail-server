<script setup lang="ts">
const range = defineModel<MetricRange>("range", { required: true });

const { snapshot, points } = defineProps<{
  snapshot: SystemSnapshot | null;
  points: HistoryPoint[];
  /** The moment of every point, for the axis. */
  at: number[];
  notice: string;
}>();

const { t, locale } = useI18n();

const tag = computed(() => locale.value.replace("_", "-"));
const count = (value: number) => Math.round(value).toLocaleString(tag.value);

// The four lines of the Postfix page, as curves in one box, each in the
// colour its dot wears there: active is mail on its way, deferred is mail that
// could not go and will be tried again, hold is mail somebody stopped,
// incoming is mail at the door. A depth, not a count: the curve is where the
// queue stood.
const CURVES = [
  { index: 0, dir: "active", color: "success" },
  { index: 1, dir: "deferred", color: "warning" },
  { index: 2, dir: "hold", color: "error" },
  { index: 3, dir: "incoming", color: "primary" },
] as const;

const series = computed(() => CURVES.map((curve) => points.map((point) => point.postfix?.[curve.index] ?? null)));
const colors = computed(() => CURVES.map((curve) => curve.color));
const names = computed(() => CURVES.map((curve) => t(`domainDashboard.postfix.${curve.dir}`)));

const max = computed(() => metricCeiling(series.value.flat(), 4));
const drawable = computed(() => metricKnown(series.value[0] ?? []) > 1);
const queue = computed(() => snapshot?.postfix ?? null);
const waiting = computed(() =>
  queue.value ? queue.value.active + queue.value.deferred + queue.value.hold + queue.value.incoming : 0
);

// The live depth of each queue, the figure then its name, like the load card.
const legend = computed(() => {
  const live = queue.value;
  if (!live) return [];
  return CURVES.map((curve, position) => `${count(live[curve.dir])} · ${names.value[position]}`);
});
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-send" class="size-4 text-primary" />
            {{ t("supervision.postfix") }}
          </span>
          <span v-if="queue" class="text-xs text-dimmed">{{ t("supervision.postfixWaiting", { n: count(waiting) }) }}</span>
        </div>
        <MetricRanges v-model="range" />
      </div>
    </template>

    <div v-if="queue" class="space-y-4">
      <MetricChart
        v-if="drawable"
        :series="series"
        :max="max"
        :max-label="count(max)"
        :legend="legend"
        :names="names"
        :colors="colors"
        :format="count"
        :at="at"
        :live="range === 'minute'"
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>

    <p v-else class="text-sm text-muted">{{ t("supervision.postfixUnavailable") }}</p>
  </UCard>
</template>
