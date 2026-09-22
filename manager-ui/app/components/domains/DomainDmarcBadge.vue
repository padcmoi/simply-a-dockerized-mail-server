<script setup lang="ts">
const { domainId, to = null } = defineProps<{ domainId: number; to?: string | null }>();

const { t } = useI18n();

const { data: record, status } = useDomainDmarcRecord(() => domainId);
</script>

<template>
  <USkeleton v-if="status === 'pending' && !record" class="h-6 w-20" />
  <DomainStatusBadge
    v-else-if="record"
    label="DMARC"
    :ok="record.reportsHere"
    :tooltip="record.reportsHere ? t('domainDashboard.dmarc.dnsMatch') : t('domainDashboard.dmarc.badgeMismatch')"
    :to="to"
  />
</template>
