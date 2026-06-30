<script setup lang="ts">
const emit = defineEmits<{ delete: [] }>();

const props = defineProps<{
  item: { id: number; domain: string; quota: string; active: number };
}>();

const MB = 1024 * 1024;
const quotaMb = computed(() => {
  const bytes = Number(props.item.quota);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0";
  return String(Math.round(bytes / MB));
});

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="flex items-center justify-between gap-2">
      <span class="font-semibold truncate">{{ item.domain }}</span>
      <UBadge :color="item.active ? 'success' : 'neutral'" variant="subtle" size="sm">
        {{ item.active ? t("common.yes") : t("common.no") }}
      </UBadge>
    </div>
    <div class="mt-2 space-y-1 text-sm">
      <div class="flex gap-2">
        <span class="text-muted w-24 shrink-0">{{ t("domains.table.id") }}</span>
        <span>{{ item.id }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-24 shrink-0">{{ t("domains.table.quotaMb") }}</span>
        <span>{{ quotaMb }} Mo</span>
      </div>
    </div>
    <div class="mt-3 pt-3 border-t border-default flex justify-end">
      <UButton icon="i-lucide-trash-2" size="sm" color="error" variant="outline" @click="emit('delete')">
        {{ t("common.delete") }}
      </UButton>
    </div>
  </UCard>
</template>
