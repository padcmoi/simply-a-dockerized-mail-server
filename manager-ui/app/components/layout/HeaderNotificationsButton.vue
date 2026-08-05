<script setup lang="ts">
const { t, locale } = useI18n();
const { unread, items, refresh, markRead, markAllRead } = useNotifications();

const open = ref(false);

const formatter = computed(
  () => new Intl.DateTimeFormat(locale.value.replace("_", "-"), { dateStyle: "medium", timeStyle: "short" })
);

// One icon per source, so a machine alert is not read as a ticket at a glance.
const ICONS: Record<string, string> = {
  support: "i-lucide-life-buoy",
  supervision: "i-lucide-activity",
};

function label(row: NotificationRow) {
  const p = row.payload ?? {};
  return t(`notifications.event.${row.type}`, {
    subject: p.subject ?? "",
    domain: p.domainName ?? "",
    actor: p.actor ?? t("notifications.someone"),
    status: p.status ? t(`tickets.status.${p.status}`) : "",
    percent: p.percent ?? 0,
  });
}

async function openNotification(row: NotificationRow) {
  open.value = false;
  if (!row.readAt) await markRead(row.id);
  if (row.link) await navigateTo(row.link);
}

onMounted(() => refresh().catch(() => undefined));
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <UChip
      :text="unread > 99 ? '99+' : unread"
      :show="unread > 0"
      color="error"
      size="3xl"
      position="top-right"
      :ui="{ base: 'h-[18px] min-w-[18px] px-[4px] text-[12px] leading-none font-semibold tabular-nums text-center' }"
    >
      <UButton
        icon="i-lucide-bell"
        color="neutral"
        variant="ghost"
        :aria-label="t('notifications.title')"
        :title="t('notifications.title')"
      />
    </UChip>

    <template #content>
      <div class="w-80 sm:w-96 max-h-[70vh] flex flex-col">
        <div class="flex items-center justify-between gap-2 p-3 border-b border-default">
          <p class="font-semibold text-sm">{{ t("notifications.title") }}</p>
          <UButton
            v-if="unread > 0"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-check-check"
            :label="t('notifications.markAllRead')"
            @click="markAllRead"
          />
        </div>

        <p v-if="!items.length" class="p-6 text-sm text-muted text-center">
          {{ t("notifications.empty") }}
        </p>

        <div v-else class="overflow-y-auto divide-y divide-default">
          <button
            v-for="row in items"
            :key="row.id"
            type="button"
            class="w-full text-left p-3 flex gap-3 hover:bg-elevated/50 transition-colors"
            @click="openNotification(row)"
          >
            <UIcon
              :name="ICONS[row.source] ?? 'i-lucide-bell'"
              class="size-4 mt-0.5 shrink-0"
              :class="row.readAt ? 'text-muted' : 'text-primary'"
            />
            <span class="min-w-0 flex-1">
              <span class="block text-sm" :class="{ 'font-medium': !row.readAt }">{{ label(row) }}</span>
              <span class="block text-xs text-muted mt-0.5">{{ formatter.format(new Date(row.createdAt)) }}</span>
            </span>
            <span v-if="!row.readAt" class="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>
