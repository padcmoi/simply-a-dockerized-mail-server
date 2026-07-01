<script setup lang="ts">
import { formatBytes, useDiskChartData } from "~/composables/useDiskChartData";

const props = defineProps<{
  totalBytes: number;
  freeBytes: number;
  reservedBytes: number;
}>();

const input = computed(() => ({
  totalBytes: props.totalBytes,
  freeBytes: props.freeBytes,
  reservedBytes: props.reservedBytes,
}));

const { chartData, chartOptions, usedBytes, reservedBytes: reservedSafe, freeBytes: freeBytesComputed } = useDiskChartData(input);

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col sm:flex-row items-center gap-6">
    <div class="relative shrink-0 w-36 h-36">
      <ChartsDoughnutChart :data="chartData" :options="chartOptions" />
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span class="text-xs text-muted font-medium">{{ formatBytes(usedBytes) }}</span>
        <span class="text-[10px] text-dimmed">/ {{ formatBytes(totalBytes) }}</span>
      </div>
    </div>

    <ul class="space-y-2 text-sm min-w-0">
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-error shrink-0" />
        <span class="text-muted">{{ t("dashboard.disk.used") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(usedBytes) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-warning shrink-0" />
        <span class="text-muted">{{ t("dashboard.disk.reserved") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(reservedSafe) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-success shrink-0" />
        <span class="text-muted">{{ t("dashboard.disk.free") }}</span>
        <span class="font-medium ml-auto pl-4">{{ formatBytes(freeBytesComputed) }}</span>
      </li>
    </ul>
  </div>
</template>
