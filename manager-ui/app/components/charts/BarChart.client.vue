<script setup lang="ts">
import { Bar } from "vue-chartjs";
import * as ChartJS from "chart.js";

const { Chart, BarElement, CategoryScale, LinearScale, Tooltip } = ChartJS;
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip);

defineProps<{
  data: ChartJS.ChartData<"bar">;
  options: ChartJS.ChartOptions<"bar">;
  height: number;
}>();
</script>

<template>
  <div class="w-full" :style="{ height: `${height}px` }">
    <Bar :data="data" :options="options" />
  </div>
</template>
