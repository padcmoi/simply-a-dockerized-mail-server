<script setup lang="ts">
import { Doughnut } from "vue-chartjs";
import * as ChartJS from "chart.js";

const { Chart, ArcElement, Tooltip } = ChartJS;
Chart.register(ArcElement, Tooltip);

defineProps<{
  data: ChartJS.ChartData<"doughnut">;
  options: ChartJS.ChartOptions<"doughnut">;
}>();
</script>

<template>
  <Doughnut :data="data" :options="options" />
</template>
