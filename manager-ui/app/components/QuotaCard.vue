<script setup lang="ts">
defineProps<{
  item: {
    domain?: string;
    email?: string;
    bytes: string;
    messages: string;
    lastActivity: string;
  };
}>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="font-semibold break-all">{{ item.email ?? item.domain }}</div>
    <div class="mt-2 space-y-1 text-sm">
      <div class="flex gap-2">
        <span class="text-muted w-32 shrink-0">{{ t("common.bytes") }}</span>
        <span>{{ item.bytes }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-32 shrink-0">{{ t("common.messages") }}</span>
        <span>{{ item.messages }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-32 shrink-0">{{ t("common.lastActivity") }}</span>
        <span>{{ item.lastActivity }}</span>
      </div>
    </div>
  </UCard>
</template>
