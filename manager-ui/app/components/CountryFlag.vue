<script setup lang="ts">
// A country flag drawn as an SVG icon, never as a regional-indicator emoji:
// Windows has no flag glyph, so an emoji flag shows up there as the two bare
// letters. `code` is an ISO 3166-1 alpha-2 code ("FR"), empty or unknown falls
// back to the collection's neutral "xx" globe. The size is the caller's, so no
// default one competes with the class it passes.
const props = defineProps<{ code?: string | null }>();

const icon = computed(() => countryFlagIcon(props.code ?? ""));
</script>

<template>
  <UIcon :name="icon" class="shrink-0" />
</template>
