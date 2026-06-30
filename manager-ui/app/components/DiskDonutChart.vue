<script setup lang="ts">
const props = defineProps<{
  totalBytes: number;
  freeBytes: number;
  reservedBytes: number;
}>();

const { t } = useI18n();

const SIZE = 140;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const cx = SIZE / 2;
const cy = SIZE / 2;

const usedBytes = computed(() => Math.max(0, props.totalBytes - props.freeBytes));
const reservedSafe = computed(() => Math.min(props.reservedBytes, props.freeBytes));
const freeSafe = computed(() => Math.max(0, props.freeBytes - reservedSafe.value));

const usedPct = computed(() => (props.totalBytes > 0 ? usedBytes.value / props.totalBytes : 0));
const reservedPct = computed(() => (props.totalBytes > 0 ? reservedSafe.value / props.totalBytes : 0));
const freePct = computed(() => (props.totalBytes > 0 ? freeSafe.value / props.totalBytes : 0));

const usedDash = computed(() => `${usedPct.value * C} ${C}`);
const reservedDash = computed(() => `${reservedPct.value * C} ${C}`);
const freeDash = computed(() => `${freePct.value * C} ${C}`);

const usedOffset = computed(() => 0);
const reservedOffset = computed(() => -usedPct.value * C);
const freeOffset = computed(() => -(usedPct.value + reservedPct.value) * C);

function fmt(bytes: number) {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
</script>

<template>
  <div class="flex flex-col sm:flex-row items-center gap-6">
    <div class="relative shrink-0">
      <svg :width="SIZE" :height="SIZE" class="-rotate-90">
        <circle :cx="cx" :cy="cy" :r="R" fill="none" stroke-width="3" class="stroke-accented/20" />
        <circle
          v-if="usedPct > 0"
          :cx="cx"
          :cy="cy"
          :r="R"
          fill="none"
          :stroke-width="STROKE"
          stroke-linecap="butt"
          class="stroke-error"
          :stroke-dasharray="usedDash"
          :stroke-dashoffset="usedOffset"
        />
        <circle
          v-if="reservedPct > 0"
          :cx="cx"
          :cy="cy"
          :r="R"
          fill="none"
          :stroke-width="STROKE"
          stroke-linecap="butt"
          class="stroke-warning"
          :stroke-dasharray="reservedDash"
          :stroke-dashoffset="reservedOffset"
        />
        <circle
          v-if="freePct > 0"
          :cx="cx"
          :cy="cy"
          :r="R"
          fill="none"
          :stroke-width="STROKE"
          stroke-linecap="butt"
          class="stroke-success"
          :stroke-dasharray="freeDash"
          :stroke-dashoffset="freeOffset"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-xs text-muted font-medium">{{ fmt(usedBytes) }}</span>
        <span class="text-[10px] text-dimmed">/ {{ fmt(totalBytes) }}</span>
      </div>
    </div>

    <ul class="space-y-2 text-sm min-w-0">
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-error shrink-0" />
        <span class="text-muted">{{ t("dashboard.disk.used") }}</span>
        <span class="font-medium ml-auto pl-4">{{ fmt(usedBytes) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-warning shrink-0" />
        <span class="text-muted">{{ t("dashboard.disk.reserved") }}</span>
        <span class="font-medium ml-auto pl-4">{{ fmt(reservedBytes) }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm bg-success shrink-0" />
        <span class="text-muted">{{ t("dashboard.disk.free") }}</span>
        <span class="font-medium ml-auto pl-4">{{ fmt(freeBytes) }}</span>
      </li>
    </ul>
  </div>
</template>
