<script setup lang="ts">
const props = defineProps<{
  item: {
    domain?: string;
    email?: string;
    // The domain aggregate row has no reservation of its own, only counters,
    // so quota and its occupancy bar are recipient-only.
    quota?: string;
    bytes: string;
    messages: string;
    lastActivity: string;
  };
}>();

const percent = computed(() => occupancyPercent(Number(props.item.quota ?? 0), Number(props.item.bytes)));
const color = computed(() => occupancyColor(percent.value));

const { t } = useI18n();
const { formatDateTime } = useDateTime();
</script>

<template>
  <UCard>
    <div class="font-semibold break-all">{{ item.email ?? item.domain }}</div>
    <div class="mt-2 space-y-1 text-sm">
      <div v-if="item.quota !== undefined" class="flex gap-2">
        <span class="text-muted w-32 shrink-0">{{ t("recipients.table.quota") }}</span>
        <span>{{ formatBytes(Number(item.quota)) }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-32 shrink-0">{{ t("recipients.table.used") }}</span>
        <span>{{ formatBytes(Number(item.bytes)) }}</span>
      </div>
      <UProgress v-if="item.quota !== undefined" :model-value="percent" :color="color" size="xs" />
      <div class="flex gap-2">
        <span class="text-muted w-32 shrink-0">{{ t("common.messages") }}</span>
        <span>{{ Number(item.messages).toLocaleString() }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-32 shrink-0">{{ t("common.lastActivity") }}</span>
        <span>{{ formatDateTime(item.lastActivity) }}</span>
      </div>
    </div>
  </UCard>
</template>
