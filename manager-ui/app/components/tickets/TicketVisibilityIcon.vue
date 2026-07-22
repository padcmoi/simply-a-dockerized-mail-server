<script setup lang="ts">
const props = defineProps<{ visibility: string }>();

const { t } = useI18n();

const isPrivate = computed(() => props.visibility !== "public");
const label = computed(() => t(`tickets.visibility.${isPrivate.value ? "private" : "public"}`));
</script>

<template>
  <UTooltip :text="label">
    <UIcon
      :name="isPrivate ? 'i-lucide-lock' : 'i-lucide-globe'"
      :class="isPrivate ? 'text-warning' : 'text-muted'"
      class="size-3.5 shrink-0"
      :aria-label="label"
    />
  </UTooltip>
</template>
