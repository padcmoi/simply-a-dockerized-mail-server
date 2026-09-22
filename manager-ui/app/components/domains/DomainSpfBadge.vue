<script setup lang="ts">
const { domainId, to = null } = defineProps<{ domainId: number; to?: string | null }>();

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
  <DomainStatusBadge v-else-if="record" label="SPF" :ok="state === 'ok'" :tooltip="tooltip" :to="to" />
</template>
