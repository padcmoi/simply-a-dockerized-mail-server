<script setup lang="ts">
// The breadcrumb is provided here rather than around the page alone: the header
// bar is what draws it, so it has to sit above both.
provideBreadcrumb();
</script>

<template>
  <UMain class="flex flex-1 min-h-dvh">
    <AppNavigation />

    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader />

      <div class="flex flex-col flex-1 min-w-0">
        <slot />
      </div>
    </div>
  </UMain>
</template>
