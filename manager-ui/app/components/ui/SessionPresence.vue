<script setup lang="ts">
// Presence for an active session: the green "Online" badge while the session is
// currently in use, otherwise the last time it was seen ("Last seen 3 min ago").
// Shared by the profile sessions page and the admin per-account active page.
const props = defineProps<{ online: boolean; lastSeenAt: string | null }>();

const { t } = useI18n();
const { timeAgo } = useDateTime();

const seen = computed(() => (props.lastSeenAt ? timeAgo(props.lastSeenAt) : null));
</script>

<template>
  <UBadge v-if="online" color="success" variant="solid" icon="i-lucide-circle" class="shrink-0">
    {{ t("profile.sessionsPage.online") }}
  </UBadge>
  <span v-else-if="seen" class="text-xs text-muted shrink-0 whitespace-nowrap">
    {{ t("profile.sessionsPage.lastSeen", { time: seen }) }}
  </span>
</template>
