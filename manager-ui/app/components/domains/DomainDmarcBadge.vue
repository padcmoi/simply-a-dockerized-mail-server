<script setup lang="ts">
const { domainId } = defineProps<{ domainId: number }>();

const { t } = useI18n();

const { data: record, status } = useDomainDmarcRecord(() => domainId);
</script>

<template>
  <USkeleton v-if="status === 'pending' && !record" class="h-6 w-20" />
  <UTooltip
    v-else-if="record"
    :text="record.reportsHere ? t('domainDashboard.dmarc.dnsMatch') : t('domainDashboard.dmarc.badgeMismatch')"
  >
    <UBadge
      :color="record.reportsHere ? 'success' : 'error'"
      variant="subtle"
      :icon="record.reportsHere ? 'i-lucide-shield-check' : 'i-lucide-shield-x'"
    >
      DMARC
    </UBadge>
  </UTooltip>
</template>
