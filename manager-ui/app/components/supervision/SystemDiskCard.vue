<script setup lang="ts">
const range = defineModel<MetricRange>("range", { required: true });

const { snapshot, points } = defineProps<{
  snapshot: SystemSnapshot | null;
  points: HistoryPoint[];
  at: number[];
  notice: string;
}>();

const { t } = useI18n();

const series = computed(() => [points.map((point) => point.disk?.[1] ?? null), points.map((point) => point.disk?.[0] ?? null)]);

const max = computed(() => metricCeiling(series.value.flat(), 1));
const drawable = computed(() => metricKnown(series.value[1] ?? []) > 1);
const live = computed(() => snapshot?.disk ?? null);

const legend = computed(() => {
  const disk = live.value;
  if (!disk) return [];

  return [
    `${t("supervision.diskTotal")} · ${formatBytes(disk.total)}`,
    `${t("supervision.diskUsed")} · ${formatBytes(disk.used)}`,
  ];
});
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-hard-drive" class="size-4 text-primary" />
            {{ t("supervision.disk") }}
          </span>
          <span v-if="live" class="text-xs text-dimmed">
            {{ formatBytes(live.used) }} {{ t("supervision.memoryDetail", { total: formatBytes(live.total) }) }}
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
        :max-label="formatBytes(max)"
        :min-label="formatBytes(0)"
        :legend="legend"
        :names="[t('supervision.diskTotal'), t('supervision.diskUsed')]"
        :format="formatBytes"
        variant="series"
        :at="at"
        :live="range === 'minute'"
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>

    <p v-else class="text-sm text-muted">{{ t("supervision.diskUnavailable") }}</p>
  </UCard>
</template>
