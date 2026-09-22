<script setup lang="ts">
const { ok, to = null } = defineProps<{ label: string; ok: boolean; tooltip: string; to?: string | null }>();

const link = computed(() => (ok ? null : to));
</script>

<template>
  <UTooltip :text="tooltip">
    <NuxtLink v-if="link" :to="link" class="rounded-md transition-opacity hover:opacity-75">
      <UBadge color="error" variant="subtle" icon="i-lucide-shield-x" class="cursor-pointer">{{ label }}</UBadge>
    </NuxtLink>
    <UBadge v-else :color="ok ? 'success' : 'error'" variant="subtle" :icon="ok ? 'i-lucide-shield-check' : 'i-lucide-shield-x'">
      {{ label }}
    </UBadge>
  </UTooltip>
</template>
