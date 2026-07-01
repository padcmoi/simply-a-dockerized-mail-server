<script setup lang="ts">
import type { RspamdHistoryRow } from "~/composables/useDomainDashboard";
import { rspamdActionColor } from "~/composables/useRspamdPage";

const props = defineProps<{
  history: RspamdHistoryRow[];
  loading: boolean;
}>();

const scanned = computed(() => props.history.length);
const rejected = computed(() => props.history.filter((r) => r.action === "reject").length);
const greylisted = computed(() => props.history.filter((r) => r.action === "greylist").length);
const clean = computed(() => props.history.filter((r) => r.action === "no action").length);
const spamRate = computed(() => (scanned.value > 0 ? ((rejected.value / scanned.value) * 100).toFixed(1) : "0"));
const recent = computed(() => props.history.slice(0, 5));

const { t } = useI18n();
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t("domainDashboard.rspamd.title") }}</h2>
    </template>

    <div v-if="props.loading && scanned === 0" class="flex justify-center py-4">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>

    <div v-else-if="scanned === 0" class="text-sm text-muted text-center py-4">
      {{ t("domainDashboard.rspamd.noHistory") }}
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="bg-elevated rounded-lg p-3">
          <p class="text-muted text-xs">
            {{ t("domainDashboard.rspamd.scanned") }}
          </p>
          <p class="text-2xl font-semibold mt-1">
            {{ scanned.toLocaleString() }}
          </p>
        </div>
        <div class="bg-elevated rounded-lg p-3">
          <p class="text-muted text-xs">
            {{ t("domainDashboard.rspamd.spam") }}
          </p>
          <p class="text-2xl font-semibold mt-1 text-error">
            {{ rejected.toLocaleString() }}
          </p>
          <p class="text-xs text-dimmed">{{ spamRate }}%</p>
        </div>
        <div class="bg-elevated rounded-lg p-3">
          <p class="text-muted text-xs">
            {{ t("domainDashboard.rspamd.greylist") }}
          </p>
          <p class="text-2xl font-semibold mt-1 text-warning">
            {{ greylisted.toLocaleString() }}
          </p>
        </div>
        <div class="bg-elevated rounded-lg p-3">
          <p class="text-muted text-xs">
            {{ t("domainDashboard.rspamd.ham") }}
          </p>
          <p class="text-2xl font-semibold mt-1 text-success">
            {{ clean.toLocaleString() }}
          </p>
        </div>
      </div>

      <div v-if="recent.length" class="space-y-1">
        <p class="text-xs text-muted font-medium">
          {{ t("domainDashboard.rspamd.recentScans") }}
        </p>
        <ul class="divide-y divide-default">
          <li v-for="row in recent" :key="row['message-id']" class="flex items-center justify-between gap-2 py-1.5 text-xs">
            <span class="truncate text-muted min-w-0 flex-1">{{ row.sender_smtp }}</span>
            <UBadge :color="rspamdActionColor(row.action)" variant="subtle" size="xs" class="shrink-0">
              {{ row.action }}
            </UBadge>
            <span class="text-dimmed shrink-0">{{ row.score.toFixed(1) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </UCard>
</template>
