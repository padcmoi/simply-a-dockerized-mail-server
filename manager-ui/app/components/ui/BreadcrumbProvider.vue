<script setup lang="ts">
const items = provideBreadcrumb();
</script>

<template>
  <div class="flex flex-col flex-1 min-w-0">
    <nav v-if="items.length" class="px-4 sm:px-6 py-2.5 border-b border-default">
      <UBreadcrumb :items="items">
        <template #item-label="{ item }">
          <TruncatedText :text="String(item.label ?? '')" :limit="26" />
        </template>
      </UBreadcrumb>
    </nav>
    <slot />
  </div>
</template>
