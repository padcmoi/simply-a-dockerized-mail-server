<script setup lang="ts">
import type { RspamdStats } from "~/composables/useDomainDashboard";

defineProps<{
  rspamd: RspamdStats | null;
  unavailable: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t("domainDashboard.rspamd.title") }}</h2>
    </template>
    <UAlert
      v-if="unavailable"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      :title="t('domainDashboard.rspamd.unavailable')"
    />
    <div v-else-if="rspamd" class="grid grid-cols-2 gap-3 text-sm">
      <div class="bg-elevated rounded-lg p-3">
        <p class="text-muted text-xs">{{ t("domainDashboard.rspamd.scanned") }}</p>
        <p class="text-2xl font-semibold mt-1">{{ rspamd.scanned.toLocaleString() }}</p>
      </div>
      <div class="bg-elevated rounded-lg p-3">
        <p class="text-muted text-xs">{{ t("domainDashboard.rspamd.spam") }}</p>
        <p class="text-2xl font-semibold mt-1 text-error">{{ rspamd.actions.reject.toLocaleString() }}</p>
        <p class="text-xs text-dimmed">
          {{ rspamd.scanned > 0 ? ((rspamd.actions.reject / rspamd.scanned) * 100).toFixed(1) : "0" }}%
        </p>
      </div>
      <div class="bg-elevated rounded-lg p-3">
        <p class="text-muted text-xs">{{ t("domainDashboard.rspamd.greylist") }}</p>
        <p class="text-2xl font-semibold mt-1 text-warning">{{ rspamd.actions.greylist.toLocaleString() }}</p>
      </div>
      <div class="bg-elevated rounded-lg p-3">
        <p class="text-muted text-xs">{{ t("domainDashboard.rspamd.ham") }}</p>
        <p class="text-2xl font-semibold mt-1 text-success">{{ rspamd.actions["no action"].toLocaleString() }}</p>
      </div>
    </div>
    <div v-else class="flex justify-center py-4">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>
  </UCard>
</template>
