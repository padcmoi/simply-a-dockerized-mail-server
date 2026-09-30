<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "postfix", action: "access" },
    { resource: "postfix", action: "view-postfix-queue" },
  ],
});

const ICONS: Record<QueueName, string> = {
  active: "i-lucide-send",
  deferred: "i-lucide-clock",
  hold: "i-lucide-pause",
  incoming: "i-lucide-inbox",
};
const TINTS: Record<QueueName, string> = {
  active: "text-success",
  deferred: "text-warning",
  hold: "text-error",
  incoming: "text-primary",
};

const INDICATORS: Record<QueueName, string> = {
  active: "bg-success",
  deferred: "bg-warning",
  hold: "bg-error",
  incoming: "bg-primary",
};

const { t } = useI18n();
const { isRoot } = usePermissions();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.postfix") }]);

const { stats, listing, queue, loadingMessages, loadStats, loadMessages } = usePostfixQueue();

const tabs = computed(() =>
  QUEUE_NAMES.map((name) => ({
    value: name,
    label: t(`domainDashboard.postfix.${name}`),
  }))
);

function onPurged() {
  loadStats();
  loadMessages();
}

onMounted(() => {
  loadStats();
  loadMessages();
});
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

    <UCard v-else>
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-semibold">{{ t("postfixPage.messagesTitle") }}</h2>
          <UButton
            v-if="isRoot"
            icon="i-lucide-settings-2"
            color="neutral"
            variant="outline"
            size="sm"
            class="shrink-0"
            :aria-label="t('postfixPage.settings')"
            to="/admin/config/postfix"
          >
            <span class="hidden sm:inline">{{ t("postfixPage.settings") }}</span>
          </UButton>
        </div>
      </template>

      <div class="space-y-4 min-w-0">
        <div class="@container">
          <UTabs
            v-model="queue"
            :items="tabs"
            :content="false"
            class="w-full"
            :ui="{
              trigger: 'group flex-1 flex-col justify-center gap-1 py-2',
              label: 'hidden @md:inline text-xs',
              indicator: INDICATORS[queue],
            }"
          >
            <template #leading="{ item }">
              <span class="flex items-center gap-1.5">
                <UIcon
                  :name="ICONS[item.value]"
                  class="size-5 shrink-0 group-data-[state=active]:text-current"
                  :class="TINTS[item.value]"
                />
                <span class="font-semibold tabular-nums">{{ stats ? stats.total[item.value] : "-" }}</span>
              </span>
            </template>
          </UTabs>
        </div>

        <PostfixQueueTable :listing="listing" :loading="loadingMessages" @purged="onPurged" />
      </div>
    </UCard>
  </div>
</template>
