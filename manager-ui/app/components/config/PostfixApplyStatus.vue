<script setup lang="ts">
const props = defineProps<{ status: PostfixApplyStatus | null; appliedAt: string }>();

const { t } = useI18n();

const view = computed(() => {
  const state = props.status?.state ?? "unknown";
  const map = {
    applied: { color: "success", icon: "i-lucide-circle-check" },
    pending: { color: "warning", icon: "i-lucide-loader-circle" },
    error: { color: "error", icon: "i-lucide-circle-x" },
    unknown: { color: "neutral", icon: "i-lucide-circle-help" },
  } as const;
  return { state, ...map[state] };
});

const description = computed(() => {
  if (view.value.state === "error") return props.status?.error ?? "";
  if (view.value.state === "applied" && props.appliedAt) return t("config.postfix.status.appliedAt", { date: props.appliedAt });
  return t(`config.postfix.status.${view.value.state}Hint`);
});
</script>

<template>
  <UAlert
    :color="view.color"
    variant="subtle"
    :icon="view.icon"
    :title="t(`config.postfix.status.${view.state}`)"
    :description="description"
    :ui="{ icon: view.state === 'pending' ? 'animate-spin' : '', description: 'whitespace-pre-line break-words' }"
  />
</template>
