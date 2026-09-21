<script setup lang="ts">
const { part, whole } = defineProps<{ part: number; whole: number }>();

const { rate } = useDmarcFormat();

const value = computed(() => rate(part, whole));
const color = computed(() => {
  if (value.value === null) return "neutral";
  if (value.value >= 95) return "success";
  if (value.value >= 80) return "warning";
  return "error";
});
</script>

<template>
  <span v-if="value === null" class="text-dimmed">-</span>
  <span v-else class="flex items-center gap-2 min-w-32">
    <UProgress :model-value="value" :color="color" size="sm" class="w-20" />
    <span class="text-xs tabular-nums whitespace-nowrap">{{ value }} %</span>
  </span>
</template>
