<script setup lang="ts">
const { domainId } = defineProps<{ domainId: number }>();

const { t } = useI18n();

const { data: record, status } = useDomainSpfRecord(() => domainId);

const state = computed(() => (record.value ? spfStateOf(record.value) : null));
const tooltip = computed(() => {
  if (!state.value) return "";
  const text = t(`domainDashboard.spf.state.${state.value}`, { ips: record.value?.ips.join(", ") ?? "" });
  return state.value === "ok" ? text : `${text}. ${t("domainDashboard.spf.seeAdmin")}`;
});
</script>

<template>
  <USkeleton v-if="status === 'pending' && !record" class="h-6 w-16" />
  <UTooltip v-else-if="record" :text="tooltip">
    <UBadge
      :color="state === 'ok' ? 'success' : 'error'"
      variant="subtle"
      :icon="state === 'ok' ? 'i-lucide-shield-check' : 'i-lucide-shield-x'"
    >
      SPF
    </UBadge>
  </UTooltip>
</template>
