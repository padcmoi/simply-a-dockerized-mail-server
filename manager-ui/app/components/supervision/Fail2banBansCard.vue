<script setup lang="ts">
const range = defineModel<MetricRange>("range", { required: true });

const { snapshot, points } = defineProps<{
  snapshot: SystemSnapshot | null;
  points: HistoryPoint[];
  at: number[];
  notice: string;
}>();

const { t, locale } = useI18n();

const tag = computed(() => locale.value.replace("_", "-"));
const count = (value: number) => (Math.round(value * 10) / 10).toLocaleString(tag.value);

const jails = computed(() => {
  const names = new Set<string>(Object.keys(snapshot?.fail2ban ?? {}));
  for (const point of points) for (const name of Object.keys(point.fail2ban ?? {})) names.add(name);
  return [...names].sort();
});

const series = computed(() => jails.value.map((jail) => points.map((point) => point.fail2ban?.[jail] ?? null)));
const max = computed(() => metricCeiling(series.value.flat(), 4));
const drawable = computed(() => series.value.some((curve) => metricKnown(curve) > 1));
const live = computed(() => snapshot?.fail2ban ?? null);
const total = computed(() => Object.values(live.value ?? {}).reduce((sum, value) => sum + value, 0));

const legend = computed(() => jails.value.map((jail) => `${jail} · ${count(live.value?.[jail] ?? 0)}`));
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-shield-ban" class="size-4 text-primary" />
            {{ t("supervision.fail2ban") }}
          </span>
          <span v-if="live" class="text-xs text-dimmed">{{ t("supervision.fail2banBanned", { n: count(total) }) }}</span>
        </div>
        <MetricRanges v-model="range" />
      </div>
    </template>

    <div v-if="live || drawable" class="space-y-4">
      <MetricChart
        v-if="drawable"
        :series="series"
        :max="max"
        :max-label="count(max)"
        :legend="legend"
        :names="jails"
        :format="count"
        variant="series"
        :at="at"
        :live="range === 'minute'"
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>

    <p v-else class="text-sm text-muted">{{ t("supervision.fail2banUnavailable") }}</p>
  </UCard>
</template>
