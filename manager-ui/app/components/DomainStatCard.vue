<script setup lang="ts">
defineProps<{
  label: string;
  value: number | string;
  sub: string;
  icon: string;
  iconColor: string;
  loading?: boolean;
  to?: string;
}>();
</script>

<template>
  <UCard :ui="{ root: 'transition hover:shadow-lg' }">
    <component :is="to ? 'NuxtLink' : 'div'" :to="to" class="flex items-start justify-between gap-3">
      <div class="min-w-0 w-full">
        <p class="text-sm text-muted">{{ label }}</p>
        <template v-if="loading">
          <USkeleton class="h-8 w-14 mt-1" />
          <USkeleton class="h-3 w-24 mt-2" />
        </template>
        <template v-else>
          <p class="text-3xl font-semibold mt-1">{{ value }}</p>
          <p class="text-xs text-muted mt-1">{{ sub }}</p>
        </template>
      </div>
      <div class="rounded-lg p-2 bg-elevated">
        <UIcon :name="icon" class="text-2xl" :class="iconColor" />
      </div>
    </component>
  </UCard>
</template>
