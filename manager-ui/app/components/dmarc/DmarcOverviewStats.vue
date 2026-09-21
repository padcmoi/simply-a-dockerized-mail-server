<script setup lang="ts">
const emit = defineEmits<{ changed: [] }>();
const { overview } = defineProps<{ overview: DmarcOverview }>();

const { t } = useI18n();
const { canSend, canImport } = useDmarcAccess();
const { busy, run, scan } = useDmarcActions();
const { when, count } = useDmarcFormat();

const received = computed(() => overview.domains.reduce((sum, domain) => sum + domain.reports, 0));

const tiles = computed(() => [
  {
    label: t("dmarc.overview.evaluations"),
    value: overview.ingest.evaluations24h,
    icon: "i-lucide-scan-search",
    color: "text-primary",
  },
  { label: t("dmarc.overview.sent"), value: overview.outgoing.sent, icon: "i-lucide-send", color: "text-success" },
  { label: t("dmarc.overview.failed"), value: overview.outgoing.failed, icon: "i-lucide-circle-x", color: "text-error" },
  { label: t("dmarc.overview.skipped"), value: overview.outgoing.skipped, icon: "i-lucide-circle-slash", color: "text-warning" },
  { label: t("dmarc.overview.received"), value: received.value, icon: "i-lucide-inbox", color: "text-info" },
  { label: t("dmarc.overview.imported"), value: overview.inbox.imported, icon: "i-lucide-mail-check", color: "text-secondary" },
]);

async function onRun() {
  if (await run()) emit("changed");
}

async function onScan() {
  if (await scan()) emit("changed");
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-4">
      <UCard v-for="tile in tiles" :key="tile.label" class="grow basis-64">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted">{{ tile.label }}</p>
            <p class="text-2xl font-semibold mt-1">{{ count(tile.value) }}</p>
          </div>
          <UIcon :name="tile.icon" class="size-6 shrink-0" :class="tile.color" />
        </div>
      </UCard>
    </div>

    <UCard>
      <div class="flex flex-col lg:flex-row lg:items-center gap-4">
        <div class="min-w-0 flex-1 space-y-1.5 text-sm">
          <p class="flex items-center gap-2 font-medium">
            <UIcon
              :name="overview.settings.sendingEnabled ? 'i-lucide-calendar-check' : 'i-lucide-calendar-off'"
              class="size-4 shrink-0"
              :class="overview.settings.sendingEnabled ? 'text-success' : 'text-muted'"
            />
            {{
              overview.settings.sendingEnabled
                ? t("dmarc.overview.sendingOn", { hour: overview.settings.reportHour })
                : t("dmarc.overview.sendingOff")
            }}
          </p>
          <p v-if="overview.settings.inboxes.length" class="text-muted">
            {{ t("dmarc.overview.inboxes", { list: overview.settings.inboxes.join(", ") }) }}
          </p>
          <p v-else class="text-warning">{{ t("dmarc.overview.noInbox") }}</p>
          <p class="text-dimmed text-xs">
            {{ t("dmarc.overview.lastIngest", { when: when(overview.ingest.lastRunAt) }) }} ·
            {{ t("dmarc.overview.lastRun", { when: when(overview.outgoing.lastRunAt) }) }} ·
            {{ t("dmarc.overview.lastScan", { when: when(overview.inbox.lastRunAt) }) }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <UButton
            v-if="canSend"
            icon="i-lucide-send"
            color="primary"
            variant="subtle"
            :label="t('dmarc.overview.run')"
            :loading="busy === 'run'"
            :disabled="busy !== null"
            @click="onRun"
          />
          <UButton
            v-if="canImport"
            icon="i-lucide-mail-search"
            color="neutral"
            variant="subtle"
            :label="t('dmarc.overview.scan')"
            :loading="busy === 'scan'"
            :disabled="busy !== null"
            @click="onScan"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
