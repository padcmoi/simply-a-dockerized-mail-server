<script setup lang="ts">
const emit = defineEmits<{ administer: []; open: [] }>();

const props = defineProps<{
  item: { id: number; domain: string; quota: string; usedBytes: string; active: number };
  canAdminister: boolean;
}>();

const quotaLabel = computed(() => `${formatBytes(Number(props.item.usedBytes))} / ${formatBytes(Number(props.item.quota))}`);
const percent = computed(() => occupancyPercent(Number(props.item.quota), Number(props.item.usedBytes)));
const color = computed(() => occupancyColor(percent.value));

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
      <UProgress :model-value="percent" :color="color" size="xs" />
    </div>
    <!-- `justify-end` with `me-auto` rather than `justify-between`: the primary
         action stays pinned right even when the account cannot administer and
         the left button is not rendered at all. -->
    <div class="mt-3 pt-3 border-t border-default flex justify-end gap-2">
      <UButton
        v-if="canAdminister"
        icon="i-lucide-shield-alert"
        size="sm"
        color="warning"
        variant="outline"
        class="me-auto"
        @click="emit('administer')"
      >
        {{ t("domains.adminModal.button") }}
      </UButton>
      <UButton icon="i-lucide-arrow-right" size="sm" color="primary" variant="outline" @click="emit('open')">
        {{ t("common.manage") }}
      </UButton>
    </div>
  </UCard>
</template>
