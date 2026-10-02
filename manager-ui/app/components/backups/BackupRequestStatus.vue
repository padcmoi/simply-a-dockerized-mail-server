<script setup lang="ts">
const props = defineProps<{ pending: boolean; status: BackupRequestStatus | null }>();

const { t } = useI18n();
const { formatDateTime } = useDateTime();

const view = computed(() => {
  if (props.pending) return { state: "pending", color: "warning", icon: "i-lucide-loader-circle" } as const;
  if (props.status?.state === "error") return { state: "error", color: "error", icon: "i-lucide-circle-x" } as const;
  return { state: "applied", color: "success", icon: "i-lucide-circle-check" } as const;
});

const description = computed(() => {
  if (view.value.state === "pending") return t("backups.request.pendingHint");
  if (view.value.state === "error") return props.status?.error ?? "";
  return props.status?.at ? t("backups.request.appliedAt", { date: formatDateTime(props.status.at) }) : "";
});
</script>

<template>
  <UAlert
    v-if="pending || status"
    :color="view.color"
    variant="subtle"
    :icon="view.icon"
    :title="t(`backups.request.${view.state}`)"
    :description="description"
    :ui="{ icon: view.state === 'pending' ? 'animate-spin' : '', description: 'break-words' }"
  />
</template>
