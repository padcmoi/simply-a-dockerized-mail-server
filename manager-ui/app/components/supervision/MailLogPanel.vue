<script setup lang="ts">
const { service } = defineProps<{ service: MailLogService }>();

const { t, locale } = useI18n();

const { search, window, loadingOlder, failed, downloading, downloadFailed, download, loadOlder } = useMailLog(service);

const tabs = [
  { label: "Postfix", value: "postfix", icon: "i-lucide-send" },
  { label: "Dovecot", value: "dovecot", icon: "i-lucide-inbox" },
];

const tab = computed({
  get: () => service,
  set: (next: string) => void navigateTo(`/admin/mail-logs/${next}`),
});

const updated = computed(() => {
  const at = window.value?.updatedAt;
  return at ? new Date(at).toLocaleString(locale.value.replace(/_/g, "-")) : null;
});
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--ui-header-height))] min-w-0 flex-col gap-6 p-4 sm:p-6 xl:p-8 select-none">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-file-text"
      :title="t('mailLogs.title')"
      :description="t('mailLogs.subtitle')"
    />

    <UTabs v-model="tab" :items="tabs" :content="false" class="w-full" />

    <div class="flex flex-wrap items-center gap-3">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('mailLogs.search')" class="w-full sm:w-80" />
      <UBadge color="success" variant="subtle" size="sm">
        <span class="relative mr-1 flex size-1.5">
          <span class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
          <span class="relative inline-flex size-1.5 rounded-full bg-success" />
        </span>
        {{ t("mailLogs.live") }}
      </UBadge>
      <UButton
        icon="i-lucide-download"
        color="neutral"
        variant="subtle"
        :loading="downloading"
        :label="t('mailLogs.download')"
        @click="download"
      />
      <span v-if="window" class="ml-auto text-xs text-dimmed">
        {{ t("mailLogs.summary", { n: window.lines.length, size: formatBytes(window.size) }) }}
        <template v-if="updated"> · {{ t("mailLogs.updated", { at: updated }) }}</template>
      </span>
    </div>

    <UAlert
      v-if="downloadFailed"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('mailLogs.downloadFailed')"
    />
    <UAlert v-if="failed" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('mailLogs.loadFailed')" />

    <USkeleton v-if="!window && !failed" class="min-h-0 w-full flex-1" />
    <MailLogViewer
      v-else-if="window"
      :lines="window.lines"
      :has-older="window.start > 0"
      :loading-older="loadingOlder"
      @older="loadOlder"
    />
  </div>
</template>
