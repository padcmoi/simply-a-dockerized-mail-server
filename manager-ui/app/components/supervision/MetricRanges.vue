<script setup lang="ts">
import type { MetricRange } from "~/composables/useMetricWindow";

// The window a card is drawn over. The minute comes from the socket and the
// three others from what the recorder has kept, which is a month of samples.
const model = defineModel<MetricRange>({ required: true });

const { t } = useI18n();

function select(range: MetricRange) {
  model.value = range;
}

const ranges = computed(() => [
  { id: "week" as const, label: t("supervision.rangeWeek") },
  { id: "day" as const, label: t("supervision.rangeDay") },
  { id: "hour" as const, label: t("supervision.rangeHour") },
  { id: "minute" as const, label: t("supervision.rangeMinute") },
]);
</script>

<template>
  <div class="flex items-center gap-1">
    <UButton
      v-for="range in ranges"
      :key="range.id"
      size="xs"
      :color="range.id === model ? 'primary' : 'neutral'"
      :variant="range.id === model ? 'subtle' : 'ghost'"
      :label="range.label"
      @click="select(range.id)"
    />
  </div>
</template>
