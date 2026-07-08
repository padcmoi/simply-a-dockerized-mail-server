<script setup lang="ts">
const emit = defineEmits<{ delete: [] }>();

withDefaults(
  defineProps<{
    item: { id: number; email: string; quota: string; active: number };
    isPostmaster?: boolean;
  }>(),
  { isPostmaster: false }
);

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-semibold break-all">{{ item.email }}</span>
        <UBadge v-if="isPostmaster" color="neutral" variant="subtle" size="xs" icon="i-lucide-lock" class="shrink-0">
          {{ t("recipients.postmaster.badge") }}
        </UBadge>
      </div>
      <UBadge :color="item.active ? 'success' : 'neutral'" variant="subtle" size="sm" class="shrink-0">
        {{ item.active ? t("common.yes") : t("common.no") }}
      </UBadge>
    </div>
    <div class="mt-2 space-y-1 text-sm">
      <div class="flex gap-2">
        <span class="text-muted w-24 shrink-0">{{ t("recipients.table.quota") }}</span>
        <span>{{ item.quota }}</span>
      </div>
    </div>
    <div class="mt-3 pt-3 border-t border-default flex justify-end">
      <UButton v-if="!isPostmaster" icon="i-lucide-trash-2" size="sm" color="error" variant="outline" @click="emit('delete')">
        {{ t("common.delete") }}
      </UButton>
      <span v-else class="text-xs text-dimmed italic">{{ t("recipients.postmaster.locked") }}</span>
    </div>
  </UCard>
</template>
