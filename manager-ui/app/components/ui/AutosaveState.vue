<script setup lang="ts">
// What a card shows where its save button used to sit: the write in flight, or
// the promise that there is nothing to press. Sits in the card header, next to
// the title.
defineProps<{ saving: boolean }>();

const { t } = useI18n();
</script>

<template>
  <span v-if="saving" class="flex items-center gap-1.5 text-sm text-muted shrink-0">
    <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
    {{ t("common.saving") }}
  </span>
  <span v-else class="text-sm text-muted shrink-0">{{ t("common.autosaveHint") }}</span>
</template>
