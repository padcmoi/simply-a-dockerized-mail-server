<script setup lang="ts">
const emit = defineEmits<{ delete: [] }>();

defineProps<{
  item: { id: number; source: string; destination: string; domain: string };
}>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="font-semibold break-all">{{ item.source }}</div>
    <div class="mt-1 flex items-center gap-1 text-sm text-muted">
      <UIcon name="i-lucide-arrow-right" class="shrink-0" />
      <span class="break-all">{{ item.destination }}</span>
    </div>
    <div class="mt-2 flex gap-2 text-sm">
      <span class="text-muted w-24 shrink-0">{{ t("aliases.table.domain") }}</span>
      <span>{{ item.domain }}</span>
    </div>
    <div class="mt-3 pt-3 border-t border-default flex justify-end">
      <UButton icon="i-lucide-trash-2" size="sm" color="error" variant="outline" @click="emit('delete')">
        {{ t("common.delete") }}
      </UButton>
    </div>
  </UCard>
</template>
