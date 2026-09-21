<script setup lang="ts">
const range = defineModel<MetricRange>("range", { required: true });

const { points } = defineProps<{
  points: HistoryPoint[];
  at: number[];
  notice: string;
}>();

const { t, locale } = useI18n();

const tag = computed(() => locale.value.replace("_", "-"));
const count = (value: number) => Math.round(value).toLocaleString(tag.value);

const live = computed(() => range.value === "minute");
const series = computed(() => [0, 1].map((index) => points.map((point) => point.dmarc?.[index] ?? null)));
const names = computed(() => [t("supervision.dmarcPass"), t("supervision.dmarcFail")]);

const totals = computed(() => series.value.map((values) => values.reduce<number>((sum, value) => sum + (value ?? 0), 0)));
const evaluated = computed(() => (totals.value[0] ?? 0) + (totals.value[1] ?? 0));
const rate = computed(() => (evaluated.value > 0 ? Math.round(((totals.value[0] ?? 0) / evaluated.value) * 1000) / 10 : null));

const max = computed(() => metricCeiling(series.value.flat(), 4));
const drawable = computed(() => !live.value && metricKnown(series.value[0] ?? []) > 1);
const legend = computed(() => names.value.map((name, index) => `${count(totals.value[index] ?? 0)} · ${name}`));
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <NuxtLink to="/admin/dmarc" class="flex items-center gap-2 font-medium hover:underline">
            <UIcon name="i-lucide-mail-search" class="size-4 text-primary" />
            {{ t("supervision.dmarc") }}
          </NuxtLink>
          <span v-if="!live" class="text-xs text-dimmed">{{ t("supervision.dmarcEvaluated", { n: count(evaluated) }) }}</span>
          <UBadge
            v-if="!live && rate !== null"
            :color="rate >= 95 ? 'success' : rate >= 80 ? 'warning' : 'error'"
            variant="subtle"
            size="sm"
          >
            {{ rate }} %
          </UBadge>
        </div>
        <MetricRanges v-model="range" />
      </div>
    </template>

    <p v-if="live" class="h-48 text-xs text-dimmed">{{ t("supervision.dmarcNoLive") }}</p>
    <div v-else class="space-y-4">
      <MetricChart
        v-if="drawable"
        :series="series"
        :max="max"
        :max-label="count(max)"
        :legend="legend"
        :names="names"
        :colors="['success', 'error']"
        :format="count"
        :at="at"
      />
      <p v-else class="h-48 text-xs text-dimmed">{{ notice }}</p>
    </div>
  </UCard>
</template>
