<script setup lang="ts">
const emit = defineEmits<{ copy: [text: string] }>();
const { domainId } = defineProps<{ domainId: number | null }>();

const { t } = useI18n();

const { data: record, status, refresh } = useDomainDmarcRecord(() => domainId);
</script>

<template>
  <div class="space-y-4">
    <div v-if="status === 'pending' && !record" class="space-y-3">
      <USkeleton class="h-8 w-72" />
      <USkeleton class="h-16 w-full" />
    </div>

    <UAlert
      v-else-if="status === 'error'"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('domainDashboard.dmarc.loadFailed')"
    />

    <ContentPanel v-else-if="record" class="space-y-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 min-w-0 flex-wrap">
          <UIcon name="i-lucide-mail-search" class="text-warning shrink-0" />
          <UTooltip :text="record.reportsHere ? t('domainDashboard.dmarc.dnsMatch') : t('domainDashboard.dmarc.dnsMismatch')">
            <UBadge
              :color="record.reportsHere ? 'success' : 'error'"
              variant="subtle"
              :icon="record.reportsHere ? 'i-lucide-shield-check' : 'i-lucide-shield-x'"
            >
              DMARC
            </UBadge>
          </UTooltip>
          <UBadge color="neutral" variant="subtle" class="font-mono text-xs truncate max-w-[240px]">{{ record.dnsName }}</UBadge>
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            :title="record.dnsName"
            @click.stop="emit('copy', record.dnsName)"
          />
        </div>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          :loading="status === 'pending'"
          @click="refresh()"
        >
          {{ t("domainDashboard.dmarc.recheck") }}
        </UButton>
      </div>

      <div class="bg-elevated rounded-md p-3">
        <div class="flex items-start justify-between gap-2">
          <p class="font-mono text-xs break-all text-muted leading-relaxed flex-1">{{ record.txtRecord }}</p>
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            class="shrink-0"
            @click="emit('copy', record.txtRecord)"
          />
        </div>
      </div>

      <p class="text-xs text-muted">{{ t("domainDashboard.dmarc.mailboxHint", { mailbox: record.mailbox }) }}</p>

      <div class="text-xs">
        <p class="text-muted">{{ t("domainDashboard.dmarc.published") }}</p>
        <p v-if="record.published" class="font-mono break-all text-dimmed mt-1">{{ record.published }}</p>
        <p v-else class="text-warning mt-1">{{ t("domainDashboard.dmarc.notPublished") }}</p>
      </div>
    </ContentPanel>
  </div>
</template>
