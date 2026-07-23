<script setup lang="ts">
const emit = defineEmits<{ close: [] }>();

// Same information the avatar tooltip carries, reachable by tap: a touch screen
// has no hover, so the tooltip alone would hide it on mobile.
const props = defineProps<{
  open: boolean;
  name: string;
  avatarUrl?: string | null;
  online?: boolean;
  lastSeenAt?: string | null;
}>();

const { t } = useI18n();
const { formatDateTime, timeAgo } = useDateTime();

const status = computed(() => {
  if (props.online) return t("presence.online");
  const seen = props.lastSeenAt ? timeAgo(props.lastSeenAt) : null;
  return seen ? t("presence.lastSeen", { when: seen }) : t("presence.offline");
});
</script>

<template>
  <UModal :open="open" @update:open="emit('close')">
    <template #content>
      <UCard>
        <div class="flex items-center gap-3">
          <PresenceAvatar :src="avatarUrl" :alt="name" :online="online" :last-seen-at="lastSeenAt" size="lg" class="shrink-0" />
          <div class="min-w-0">
            <p class="font-medium truncate">{{ name }}</p>
            <p class="text-sm" :class="online ? 'text-success' : 'text-muted'">{{ status }}</p>
            <p v-if="!online && lastSeenAt" class="text-xs text-dimmed mt-0.5">{{ formatDateTime(lastSeenAt) }}</p>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
