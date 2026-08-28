<script setup lang="ts">
import type { DataTableColumn } from "~/types/data-table";
import { NOTIFICATION_SOURCES, type NotificationRow } from "~/composables/useNotifications";

definePageMeta({});

const ALL = "all";

const route = useRoute();
const { t } = useI18n();
const { formatDateTime } = useDateTime();
const { set: setBreadcrumb } = useBreadcrumb();
const toast = useToast();
const { label, icon, sourceLabel } = useNotificationLabel();
const { unread, feed, markRead, markUnread, markAllRead, remove, purge, refresh: refreshFeed } = useNotifications();
const { bump } = useDataRefresh();

setBreadcrumb([{ label: t("notifications.history.crumb") }]);

// Both filters are read from the URL and written back to it, so a reload, a
// bookmark or a link from elsewhere opens the list that was being looked at.
const readFilter = ref<"all" | "read" | "unread">(
  route.query.read === "read" || route.query.read === "unread" ? route.query.read : "all"
);
const sourceFilter = ref<string>(
  NOTIFICATION_SOURCES.includes(route.query.source as (typeof NOTIFICATION_SOURCES)[number]) ? String(route.query.source) : ALL
);
const purgeOpen = ref(false);
const purgeScope = ref<"all" | "read">("read");
const busyId = ref<number | null>(null);
// Every local write reloads the page itself; without this the feed watcher
// below would answer the same write with a second identical fetch.
const writing = ref(false);

const { items, total, loading, hasLoadedOnce, page, limit, search, sortBy, sortDir, load } = usePaginatedList<NotificationRow>(
  "notifications-history",
  "/notifications",
  "createdAt",
  [readFilter, sourceFilter],
  () => ({
    ...(readFilter.value === "all" ? {} : { read: readFilter.value }),
    ...(sourceFilter.value === ALL ? {} : { source: sourceFilter.value }),
  })
);

const readItems = computed(() => [
  { value: "all", label: t("notifications.history.filterAll") },
  { value: "unread", label: t("notifications.history.filterUnread") },
  { value: "read", label: t("notifications.history.filterRead") },
]);

const sourceItems = computed(() => [
  { value: ALL, label: t("notifications.history.filterAllSources") },
  ...NOTIFICATION_SOURCES.map((source) => ({ value: source, label: sourceLabel(source) })),
]);

const filtering = computed(() => readFilter.value !== "all" || sourceFilter.value !== ALL || search.value.length > 0);
const emptyLabel = computed(() =>
  filtering.value ? t("notifications.history.emptyFiltered") : t("notifications.history.empty")
);

const columns = computed<DataTableColumn<NotificationRow>[]>(() => [
  { key: "readAt", label: t("notifications.history.colStatus"), value: (row) => row.readAt ?? "" },
  { key: "source", label: t("notifications.history.colSource"), value: (row) => row.source },
  { key: "type", label: t("notifications.history.colMessage"), value: (row) => label(row), primary: true },
  { key: "createdAt", label: t("notifications.history.colWhen"), value: (row) => row.createdAt },
]);

watch([readFilter, sourceFilter], ([read, source]) => {
  page.value = 1;
  const query: Record<string, string> = {};
  if (read !== "all") query.read = read;
  if (source !== ALL) query.source = source;
  navigateTo({ query }, { replace: true });
});

// A notification arriving by websocket while the page is open must land in the
// table too, not only in the bell: what is watched is the feed the socket
// pushes, and the guard keeps a local write from fetching twice.
watch(
  () => feed.value.items[0]?.id ?? 0,
  (newest, previous) => {
    // `previous === 0` is the feed arriving for the first time, next to the
    // table's own first fetch, and not a notification that just came in.
    if (previous === 0 || newest === previous || writing.value) return;
    void load();
  }
);

// Deleting or purging the last rows of the last page leaves it beyond the end
// of a list that still has rows: step back rather than show an empty table
// under a pager saying otherwise.
watch([items, total], ([rows, count]) => {
  if (!loading.value && rows.length === 0 && count > 0 && page.value > 1) page.value = 1;
});

async function run(action: () => Promise<unknown>, failure: string, rowId: number | null = null) {
  busyId.value = rowId;
  writing.value = true;
  try {
    await action();
    await load();
    bump();
  } catch (e) {
    toast.add({ title: t(failure), description: (e as Error).message, color: "error" });
  } finally {
    busyId.value = null;
    writing.value = false;
  }
}

function toggleRead(row: NotificationRow) {
  return run(() => (row.readAt ? markUnread(row.id) : markRead(row.id)), "notifications.history.actionFailed", row.id);
}

function deleteRow(row: NotificationRow) {
  return run(() => remove(row.id), "notifications.history.actionFailed", row.id);
}

function readEverything() {
  return run(markAllRead, "notifications.history.actionFailed");
}

function askPurge(scope: "all" | "read") {
  purgeScope.value = scope;
  purgeOpen.value = true;
}

async function onPurgeConfirmed() {
  page.value = 1;
  await run(() => purge(purgeScope.value), "notifications.history.purgeFailed");
  toast.add({ title: t("notifications.history.purged"), color: "success" });
}

async function open(row: NotificationRow) {
  if (!row.readAt) await run(() => markRead(row.id), "notifications.history.actionFailed", row.id);
  if (row.link) await navigateTo(row.link);
}

onMounted(() => refreshFeed().catch(() => undefined));
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-bell"
      :title="t('notifications.history.title')"
      :description="t('notifications.history.description')"
    />

    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-lg">{{ t("notifications.history.listTitle") }}</h2>
        <UBadge v-if="unread > 0" color="primary" variant="subtle" size="sm">
          {{ t("notifications.history.unreadCount", { count: unread }) }}
        </UBadge>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          icon="i-lucide-check-check"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="unread === 0"
          @click="readEverything"
        >
          {{ t("notifications.markAllRead") }}
        </UButton>
        <UButton icon="i-lucide-settings-2" color="neutral" variant="ghost" to="/profile/notifications" size="sm">
          {{ t("notifications.history.preferences") }}
        </UButton>
        <UButton icon="i-lucide-eraser" color="neutral" variant="subtle" size="sm" @click="askPurge('read')">
          {{ t("notifications.history.purgeRead") }}
        </UButton>
        <UButton icon="i-lucide-trash-2" color="error" variant="subtle" size="sm" @click="askPurge('all')">
          {{ t("notifications.history.purgeAll") }}
        </UButton>
      </div>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="4" />

    <DataTable
      v-else
      v-model:page="page"
      v-model:page-size="limit"
      v-model:search="search"
      v-model:sort-key="sortBy"
      v-model:sort-direction="sortDir"
      :data="items"
      :columns="columns"
      :total="total"
      :loading="loading"
      :row-key="(row: NotificationRow) => row.id"
      :row-class="(row: NotificationRow) => (row.readAt ? '' : 'font-medium')"
      :empty-label="emptyLabel"
    >
      <template #filters>
        <USelect v-model="readFilter" :items="readItems" value-key="value" class="w-36" />
        <USelect v-model="sourceFilter" :items="sourceItems" value-key="value" class="w-40" />
      </template>

      <template #readAt="{ row }">
        <UBadge :color="row.readAt ? 'neutral' : 'primary'" variant="subtle" size="sm">
          {{ row.readAt ? t("notifications.history.read") : t("notifications.history.unread") }}
        </UBadge>
      </template>

      <template #source="{ row }">
        <span class="flex items-center gap-1.5">
          <UIcon :name="icon(row)" class="size-4 shrink-0 text-dimmed" />
          <span class="text-sm">{{ sourceLabel(row.source) }}</span>
        </span>
      </template>

      <template #type="{ row }">
        <button v-if="row.link" type="button" class="text-left hover:underline underline-offset-2" @click="open(row)">
          {{ label(row) }}
        </button>
        <span v-else>{{ label(row) }}</span>
      </template>

      <template #createdAt="{ row }">
        <span class="whitespace-nowrap text-muted">{{ formatDateTime(row.createdAt) }}</span>
      </template>

      <template #actions="{ row }">
        <div class="flex justify-end gap-1.5">
          <UButton
            :icon="row.readAt ? 'i-lucide-mail' : 'i-lucide-mail-open'"
            size="sm"
            color="neutral"
            variant="ghost"
            square
            :loading="busyId === row.id"
            :aria-label="row.readAt ? t('notifications.history.markUnread') : t('notifications.history.markRead')"
            :title="row.readAt ? t('notifications.history.markUnread') : t('notifications.history.markRead')"
            @click="toggleRead(row)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="sm"
            color="error"
            variant="ghost"
            square
            :loading="busyId === row.id"
            :aria-label="t('common.delete')"
            :title="t('common.delete')"
            @click="deleteRow(row)"
          />
        </div>
      </template>
    </DataTable>

    <ConfirmModal
      v-model:open="purgeOpen"
      :type="purgeScope === 'all' ? 'danger' : 'warning'"
      :title="purgeScope === 'all' ? t('notifications.history.purgeAllTitle') : t('notifications.history.purgeReadTitle')"
      :description="
        purgeScope === 'all' ? t('notifications.history.purgeAllDescription') : t('notifications.history.purgeReadDescription')
      "
      @confirm="onPurgeConfirmed"
    />
  </div>
</template>
