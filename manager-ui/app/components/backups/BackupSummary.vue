<script setup lang="ts">
const props = defineProps<{ overview: BackupOverview }>();

const { t } = useI18n();
const { formatDateTime, timeAgo } = useDateTime();

const RESULT_COLOR = { success: "success", partial: "warning", failed: "error" } as const;

const zone = viewerZone();

const config = computed(() => props.overview.config);
const serverZone = computed(() => config.value?.timezone || "UTC");
const localTime = computed(() => (config.value ? convertZoneTime(config.value.time, serverZone.value, zone) : ""));
const run = computed(() => props.overview.lastRun);
</script>

<template>
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
    <UCard v-if="config">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-semibold">{{ t("backups.summary.scheduleTitle") }}</h2>
          <UButton icon="i-lucide-sliders-horizontal" color="neutral" variant="outline" size="xs" to="/admin/backups/config">
            {{ t("backups.summary.configure") }}
          </UButton>
        </div>
      </template>
      <dl class="space-y-3 text-sm">
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.time") }}</dt>
          <dd class="text-right">
            <span class="font-medium">{{ localTime }}</span>
            <span class="block text-xs text-muted">
              {{ t("backups.summary.timeOnServer", { zone, serverTime: config.time, serverZone }) }}
            </span>
          </dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.keepDays") }}</dt>
          <dd class="font-medium">{{ t("backups.summary.keepDaysValue", { count: config.keepDays }) }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.dir") }}</dt>
          <dd class="min-w-0 font-mono text-xs break-all">{{ config.dir }}</dd>
        </div>
      </dl>
    </UCard>

    <UCard v-if="config">
      <template #header>
        <h2 class="font-semibold">{{ t("backups.summary.offsiteTitle") }}</h2>
      </template>
      <dl class="space-y-3 text-sm">
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.offsite") }}</dt>
          <dd class="min-w-0 font-mono text-xs break-all">{{ config.offsite || t("backups.summary.offsiteNone") }}</dd>
        </div>
        <div v-if="config.offsite" class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.deleteLocal") }}</dt>
          <dd class="font-medium">{{ config.offsiteDeleteLocal ? t("common.yes") : t("common.no") }}</dd>
        </div>
      </dl>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t("backups.summary.lastRunTitle") }}</h2>
      </template>
      <p v-if="!run" class="text-sm text-muted">{{ t("backups.summary.noRun") }}</p>
      <dl v-else class="space-y-3 text-sm">
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.result") }}</dt>
          <dd>
            <UBadge :color="RESULT_COLOR[run.result]" variant="subtle">{{ t(`backups.result.${run.result}`) }}</UBadge>
          </dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.when") }}</dt>
          <dd class="font-medium">
            <FullTooltip :text="formatDateTime(run.startedAt)">{{ timeAgo(run.startedAt) }}</FullTooltip>
          </dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.outage") }}</dt>
          <dd class="font-medium">{{ formatElapsed(run.outageSeconds) }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t("backups.summary.duration") }}</dt>
          <dd class="font-medium">{{ formatElapsed(run.durationSeconds) }}</dd>
        </div>
        <div v-if="run.error" class="text-error break-words">{{ run.error }}</div>
      </dl>
    </UCard>
  </div>
</template>
