<script setup lang="ts">
const props = defineProps<{
  stats: DomainRspamdStats;
  loading: boolean;
}>();

const scanned = computed(() => props.stats.scanned);
const rejected = computed(() => props.stats.actions.reject);
const greylisted = computed(() => props.stats.actions.greylist);
const clean = computed(() => props.stats.actions["no action"]);
const spamRate = computed(() => (scanned.value > 0 ? ((rejected.value / scanned.value) * 100).toFixed(1) : "0"));

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
    </div>
  </UCard>
</template>
