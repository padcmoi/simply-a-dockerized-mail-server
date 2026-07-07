<script setup lang="ts">
const emit = defineEmits<{ delete: []; toggle: [] }>();

defineProps<{
  item: { id: number; sender: string; enabled: number; createdAt: string; updatedAt: string };
}>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="flex items-center justify-between gap-2">
      <span class="font-semibold break-all">{{ item.sender }}</span>
      <USwitch :model-value="!!item.enabled" @update:model-value="emit('toggle')" />
    </div>
    <div class="mt-2 flex gap-2 text-sm">
      <span class="text-muted w-24 shrink-0">{{ t("sieve.table.created") }}</span>
      <span>{{ item.createdAt }}</span>
    </div>
    <div class="mt-1 flex gap-2 text-sm">
      <span class="text-muted w-24 shrink-0">{{ t("sieve.table.updated") }}</span>
      <span>{{ item.updatedAt }}</span>
    </div>
    <div class="mt-3 pt-3 border-t border-default flex justify-end">
      <UButton icon="i-lucide-trash-2" size="sm" color="error" variant="outline" @click="emit('delete')">
        {{ t("common.delete") }}
      </UButton>
    </div>
  </UCard>
</template>
