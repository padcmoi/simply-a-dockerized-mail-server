<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const { open, available, flagged, toggle, close } = usePageFold();

const label = computed(() => t(open.value ? "layout.hidePageFold" : "layout.showPageFold"));

watch(() => route.path, close);
</script>

<template>
  <UChip v-if="available" :show="flagged" color="primary" inset class="hidden compact:inline-flex">
    <UButton
      :icon="open ? 'i-lucide-panel-top-close' : 'i-lucide-panel-top-open'"
      :color="open ? 'primary' : 'neutral'"
      variant="ghost"
      :aria-expanded="open"
      :aria-label="label"
      :title="label"
      @click="toggle"
    />
  </UChip>
</template>
