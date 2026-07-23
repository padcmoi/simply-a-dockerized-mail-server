<script setup lang="ts">
import type { AvatarProps, ChipProps } from "@nuxt/ui";

const props = withDefaults(
  defineProps<{
    src?: string | null;
    alt?: string | null;
    // undefined leaves the dot off entirely (presence unknown); a boolean draws
    // it green when online, red when offline.
    online?: boolean;
    lastSeenAt?: string | null;
    size?: AvatarProps["size"];
    chipSize?: ChipProps["size"];
  }>(),
  { src: null, alt: null, online: undefined, lastSeenAt: null, size: "sm", chipSize: "md" }
);

const { t } = useI18n();
const { timeAgo } = useDateTime();

// The chip is drawn by UAvatar itself (it positions and insets it correctly);
// wrapping the avatar in a separate UChip left a stray floating dot.
const chip = computed<boolean | ChipProps>(() =>
  props.online === undefined
    ? false
    : { color: props.online ? "success" : "error", size: props.chipSize, position: "bottom-right" }
);
const label = computed(() => {
  if (props.online) return t("presence.online");
  const seen = props.lastSeenAt ? timeAgo(props.lastSeenAt) : null;
  return seen ? t("presence.lastSeen", { when: seen }) : t("presence.offline");
});
</script>

<template>
  <UAvatar
    :src="src ?? undefined"
    :alt="alt ?? undefined"
    :size="size"
    :chip="chip"
    :title="online === undefined ? undefined : label"
  />
</template>
