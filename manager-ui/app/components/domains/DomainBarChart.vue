<script setup lang="ts">
import { useDomainBarChartData } from "~/composables/useDomainBarChartData";

const props = defineProps<{
  items: { domain: string; count: number }[];
}>();

const items = computed(() => props.items);

const { chartData, chartOptions, chartHeight } = useDomainBarChartData(items);

const { t } = useI18n();
</script>

<template>
  <div v-if="items.length === 0" class="text-sm text-muted text-center py-4">
    {{ t("dashboard.recent.noDomains") }}
  </div>
  <BarChart v-else :data="chartData" :options="chartOptions" :height="chartHeight" />
</template>
