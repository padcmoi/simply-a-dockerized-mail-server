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
  <FullTooltip v-if="isLong" :text="value">
    <span :class="textClass">{{ display }}</span>
  </FullTooltip>
  <span v-else :class="textClass">{{ value }}</span>
</template>
