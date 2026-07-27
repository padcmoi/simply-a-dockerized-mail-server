<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text?: string | null;
    textClass?: string;
    limit?: number;
  }>(),
  { text: "", textClass: "", limit: 40 }
);

const value = computed(() => props.text ?? "");
const isLong = computed(() => value.value.length > props.limit);
const display = computed(() => truncateChars(value.value, props.limit));
</script>

<template>
  <UTooltip v-if="isLong" :text="value" :ui="{ content: 'max-w-md break-all' }">
    <span :class="textClass">{{ display }}</span>
  </UTooltip>
  <span v-else :class="textClass">{{ value }}</span>
</template>
