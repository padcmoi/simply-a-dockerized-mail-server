<script setup lang="ts">
const items = provideBreadcrumb();
</script>

<template>
  <div class="flex flex-col flex-1 min-w-0">
    <nav v-if="items.length" class="px-4 sm:px-6 py-2.5 border-b border-default">
      <UBreadcrumb :items="items" />
    </nav>
    <slot />
  </div>
</template>
