<script setup lang="ts">
// One card in the profile action grid: navigates (`to`), triggers an action
// (`activate` emit, e.g. open a modal), or is a disabled "coming soon" tile
// (`soon`). Keeps the profile page a flat list of cards instead of repeated markup.
const emit = defineEmits<{ activate: [] }>();
const props = defineProps<{
  icon: string;
  iconColor?: string;
  label: string;
  hint: string;
  to?: string;
  soon?: boolean;
}>();

const { t } = useI18n();

function onClick() {
  if (props.soon) return;
  if (props.to) {
    navigateTo(props.to);
    return;
  }
  emit("activate");
}
</script>

<template>
  <UCard :ui="{ root: soon ? 'opacity-60' : 'transition hover:shadow-lg cursor-pointer' }" @click="onClick">
    <div class="flex items-center gap-3">
      <UIcon :name="icon" class="text-xl shrink-0" :class="iconColor ?? 'text-primary'" />
      <div class="min-w-0">
        <p class="font-medium truncate">{{ label }}</p>
        <p class="text-xs text-muted truncate">{{ hint }}</p>
      </div>
      <UBadge v-if="soon" color="neutral" variant="subtle" size="xs" class="ml-auto shrink-0">
        {{ t("profile.soon") }}
      </UBadge>
      <UIcon v-else name="i-lucide-arrow-right" class="ml-auto text-muted shrink-0" />
    </div>
  </UCard>
</template>
