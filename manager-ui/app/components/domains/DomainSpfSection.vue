<script setup lang="ts">
const emit = defineEmits<{ copy: [text: string] }>();
const { domainId } = defineProps<{ domainId: number | null }>();

const { t } = useI18n();

const { data: record, status, refresh } = useDomainSpfRecord(() => domainId);

const state = computed(() => (record.value ? spfStateOf(record.value) : null));
const ips = computed(() => record.value?.ips.join(", ") ?? "");
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
      :title="t('domainDashboard.spf.loadFailed')"
    />

    <ContentPanel v-else-if="record && state" class="space-y-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 min-w-0 flex-wrap">
          <UIcon name="i-lucide-send-horizontal" class="text-warning shrink-0" />
          <UTooltip :text="t(`domainDashboard.spf.state.${state}`, { ips })">
            <UBadge
              :color="state === 'ok' ? 'success' : 'error'"
              variant="subtle"
              :icon="state === 'ok' ? 'i-lucide-shield-check' : 'i-lucide-shield-x'"
            >
              SPF
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
          {{ t("domainDashboard.spf.recheck") }}
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

      <p class="text-xs text-muted">
        {{
          record.ips.length
            ? t("domainDashboard.spf.hint", { ips, host: record.mailHost })
            : t("domainDashboard.spf.noAddress", { host: record.mailHost })
        }}
      </p>

      <UAlert
        v-if="state === 'multiple'"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="t('domainDashboard.spf.state.multiple')"
      />

      <div class="text-xs">
        <p class="text-muted">{{ t("domainDashboard.spf.published") }}</p>
        <p v-if="record.published" class="font-mono break-all text-dimmed mt-1">{{ record.published }}</p>
        <p v-else class="text-warning mt-1">{{ t("domainDashboard.spf.notPublished") }}</p>
      </div>
    </ContentPanel>
  </div>
</template>
