<script setup lang="ts">
const props = defineProps<{ messageId: string; recipients: QueueMessageRecipient[] }>();

const { t } = useI18n();

const open = ref(false);
const failed = computed(() => props.recipients.filter((r) => r.reason));
const lines = computed(() => failed.value.map((r) => `${r.address}: ${r.status ? `${r.status} ` : ""}${r.reason}`));
const summary = computed(() => {
  const first = failed.value[0];
  return first ? `${first.status ? `${first.status} ` : ""}${first.reason}` : "";
});

function showDetails() {
  open.value = true;
}
</script>

<template>
  <span v-if="!failed.length" class="text-muted">-</span>

  <template v-else>
    <FullTooltip :text="lines.join(' · ')">
      <UButton
        color="warning"
        variant="ghost"
        size="xs"
        trailing-icon="i-lucide-info"
        class="max-w-36 min-w-0"
        :aria-label="t('postfixPage.reasonDetails')"
        @click="showDetails"
      >
        <span class="truncate">{{ summary }}</span>
        <span v-if="failed.length > 1" class="shrink-0 text-muted">+{{ failed.length - 1 }}</span>
      </UButton>
    </FullTooltip>

    <UModal v-model:open="open" :title="t('postfixPage.reasonDetails')" :description="messageId">
      <template #body>
        <div class="space-y-4">
          <div v-for="recipient in failed" :key="recipient.address" class="space-y-1">
            <div class="flex flex-wrap items-center gap-2 min-w-0">
              <span class="font-mono text-sm break-all">{{ recipient.address }}</span>
              <UBadge v-if="recipient.status" color="warning" variant="subtle" size="sm">{{ recipient.status }}</UBadge>
            </div>
            <p class="text-sm text-warning break-words">{{ recipient.reason }}</p>
          </div>
        </div>
      </template>
    </UModal>
  </template>
</template>
