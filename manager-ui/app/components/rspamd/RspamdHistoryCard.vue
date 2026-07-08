<script setup lang="ts">
import type { RspamdHistoryItem } from "~/composables/useRspamdPage";
import { rspamdActionColor } from "~/composables/useRspamdPage";

defineProps<{
  item: RspamdHistoryItem;
}>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-2">
      <span class="font-medium break-all text-sm">{{ item.sender_smtp }}</span>
      <UBadge :color="rspamdActionColor(item.action)" variant="subtle" size="xs" class="shrink-0">
        {{ item.action }}
      </UBadge>
    </div>
    <div class="mt-2 space-y-1 text-sm">
      <div class="flex gap-2">
        <span class="text-muted w-20 shrink-0">{{ t("rspamdPage.col.to") }}</span>
        <span class="break-all">{{ item.rcpt }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-20 shrink-0">{{ t("rspamdPage.col.score") }}</span>
        <span :class="item.score > item.required_score ? 'text-error' : 'text-success'">{{ item.score.toFixed(2) }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-20 shrink-0">{{ t("rspamdPage.col.size") }}</span>
        <span>{{ formatBytes(item.size) }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-muted w-20 shrink-0">{{ t("rspamdPage.col.time") }}</span>
        <span>{{ item.time }}</span>
      </div>
    </div>
  </UCard>
</template>
