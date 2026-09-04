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

// The tiles of the rspamd page, as curves in one box, each in the tile's own
// colour and under the tile's own name: greylist, add header, reject, and
// what the filter learned. The counter itself over time, as the tile reads
// it: a curve stands where its figure stands, and climbs by one for every
// message that got that verdict. "no action" is left out: it is the mail
// that went through, and its count is the scan total on the header line
// minus the four curves.
const CURVES = [
  { index: 2, key: "greylist", label: "greylist", color: "secondary" },
  { index: 3, key: "addHeader", label: "add header", color: "warning" },
  { index: 4, key: "reject", label: "reject", color: "error" },
  { index: 5, key: "learned", label: null, color: "inverted" },
] as const;

const series = computed(() => CURVES.map((curve) => points.map((point) => point.rspamd?.[curve.index] ?? null)));
const colors = computed(() => CURVES.map((curve) => curve.color));
const names = computed(() => CURVES.map((curve) => curve.label ?? t("domainDashboard.rspamd.learned")));

const max = computed(() => metricCeiling(series.value.flat(), 4));
const drawable = computed(() => metricKnown(series.value[0] ?? []) > 1);
const counters = computed(() => snapshot?.rspamd ?? null);

// The live figure of each tile, the figure then the name, like the load card.
const legend = computed(() => {
  const live = counters.value;
  if (!live) return [];
  return CURVES.map((curve, position) => `${count(live[curve.key])} · ${names.value[position]}`);
});
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-shield-check" class="size-4 text-primary" />
            {{ t("supervision.rspamd") }}
          </span>
          <span v-if="counters" class="text-xs text-dimmed">{{
            t("supervision.rspamdScanned", { n: count(counters.scanned) })
          }}</span>
        </div>
        <MetricRanges v-model="range" />
      </div>
    </template>

    <div v-if="counters" class="space-y-4">
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

    <p v-else class="text-sm text-muted">{{ t("supervision.rspamdUnavailable") }}</p>
  </UCard>
</template>
