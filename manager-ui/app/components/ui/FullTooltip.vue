<script setup lang="ts">
defineProps<{ text?: string }>();
</script>

<template>
  <UTooltip :text="text" :ui="{ content: 'max-w-md h-auto items-start p-2', text: 'whitespace-normal break-all' }">
    <slot />
  </UTooltip>
</template>
