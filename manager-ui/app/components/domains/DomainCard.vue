<script setup lang="ts">
const emit = defineEmits<{ administer: []; open: [] }>();

const props = defineProps<{
  item: { id: number; domain: string; quota: string; usedBytes: string; active: number };
  canAdminister: boolean;
}>();

const quotaLabel = computed(() => `${formatBytes(Number(props.item.usedBytes))} / ${formatBytes(Number(props.item.quota))}`);
const occupancyPercent = computed(() => {
  const quota = Number(props.item.quota);
  if (!Number.isFinite(quota) || quota <= 0) return 0;
  return Math.min(100, (Number(props.item.usedBytes) / quota) * 100);
});
const occupancyColor = computed(() => {
  if (occupancyPercent.value > 90) return "error";
  if (occupancyPercent.value > 70) return "warning";
  return "success";
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
        <span>{{ quotaLabel }}</span>
      </div>
      <UProgress :model-value="occupancyPercent" :color="occupancyColor" size="xs" />
    </div>
    <div class="mt-3 pt-3 border-t border-default flex justify-between gap-2">
      <UButton icon="i-lucide-arrow-right" size="sm" color="primary" variant="outline" @click="emit('open')">
        {{ t("common.manage") }}
      </UButton>
      <UButton
        v-if="canAdminister"
        icon="i-lucide-shield-alert"
        size="sm"
        color="warning"
        variant="outline"
        @click="emit('administer')"
      >
        {{ t("domains.adminModal.button") }}
      </UButton>
    </div>
  </UCard>
</template>
