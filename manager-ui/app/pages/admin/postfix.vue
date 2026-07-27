<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "postfix", action: "access" },
    { resource: "postfix", action: "view-postfix-queue" },
  ],
});

interface QueueDirStats {
  active: number;
  deferred: number;
  hold: number;
  incoming: number;
}
interface PostfixQueueStats {
  total: QueueDirStats;
  available: boolean;
}

const QUEUE_DIRS = ["active", "deferred", "hold", "incoming"] as const;

const stats = ref<PostfixQueueStats | null>(null);
const loading = ref(false);

const { t } = useI18n();
const { call } = useApi();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.postfix") }]);

const realtimeQueue = useRealtimeTopic<PostfixQueueStats>("postfix-queue");
watch(realtimeQueue, (v) => {
  if (v) stats.value = v;
});
watch(useDataRefresh().tick, load);

async function load() {
  loading.value = true;
  try {
    stats.value = await call<PostfixQueueStats>("/postfix/queue");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert color="neutral" variant="subtle" icon="i-lucide-send" :title="t('postfixPage.subtitle')" />

    <UAlert
      v-if="stats && !stats.available"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      :title="t('domainDashboard.postfix.unavailable')"
    />

    <UCard v-else-if="stats">
      <template #header>
        <h2 class="font-semibold">{{ t("domainDashboard.postfix.title") }}</h2>
      </template>
      <div class="text-sm">
        <div
          v-for="dir in QUEUE_DIRS"
          :key="dir"
          class="flex items-center justify-between py-2 border-b border-default last:border-0"
        >
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="{
                'bg-success': dir === 'active',
                'bg-warning': dir === 'deferred',
                'bg-error': dir === 'hold',
                'bg-primary': dir === 'incoming',
              }"
            />
            <span class="text-muted">{{ t(`domainDashboard.postfix.${dir}`) }}</span>
          </div>
          <span class="font-semibold">{{ stats.total[dir] }}</span>
        </div>
      </div>
    </UCard>

    <div v-else class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="text-2xl text-primary animate-spin" />
    </div>
  </div>
</template>
