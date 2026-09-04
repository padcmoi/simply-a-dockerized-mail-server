<script setup lang="ts">
definePageMeta({});

const { t } = useI18n();
const { formatDateTime } = useDateTime();
const { set: setBreadcrumb } = useBreadcrumb();
const { label, icon, sourceLabel } = useNotificationLabel();

setBreadcrumb([{ label: t("notifications.history.crumb") }]);

const {
  items,
  total,
  loading,
  hasLoadedOnce,
  page,
  limit,
  search,
  searchBy,
  sortBy,
  sortDir,
  ALL,
  unread,
  readFilter,
  sourceFilter,
  busyId,
  writing,
  filtering,
  toggleRead,
  deleteRow,
  readEverything,
  purgeScope,
  open,
} = useNotificationHistory();

const purgeOpen = ref(false);
const purgeChoice = ref<"all" | "read">("read");

const readItems = computed(() => [
  { value: "all", label: t("notifications.history.filterAll") },
  { value: "unread", label: t("notifications.history.filterUnread") },
  { value: "read", label: t("notifications.history.filterRead") },
]);

const sourceItems = computed(() => [
  { value: ALL, label: t("notifications.history.filterAllSources") },
  ...NOTIFICATION_SOURCES.map((source) => ({ value: source, label: sourceLabel(source) })),
]);

const emptyLabel = computed(() =>
  filtering.value ? t("notifications.history.emptyFiltered") : t("notifications.history.empty")
);

const columns = computed<DataTableColumn<NotificationRow>[]>(() => [
  { key: "readAt", label: t("notifications.history.colStatus"), value: (row) => row.readAt ?? "", searchable: false },
  { key: "source", label: t("notifications.history.colSource"), value: (row) => row.source },
  { key: "type", label: t("notifications.history.colMessage"), value: (row) => label(row), primary: true },
  { key: "createdAt", label: t("notifications.history.colWhen"), value: (row) => row.createdAt, searchable: false },
]);

function askPurge(scope: "all" | "read") {
  purgeChoice.value = scope;
  purgeOpen.value = true;
}

const onPurgeConfirmed = () => purgeScope(purgeChoice.value);
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
          :loading="writing"
          :disabled="unread === 0 || writing"
          @click="readEverything"
        >
          {{ t("notifications.markAllRead") }}
        </UButton>
        <UButton icon="i-lucide-settings-2" color="neutral" variant="ghost" to="/profile/notifications" size="sm">
          {{ t("notifications.history.preferences") }}
        </UButton>
        <UButton icon="i-lucide-eraser" color="neutral" variant="subtle" size="sm" :disabled="writing" @click="askPurge('read')">
          {{ t("notifications.history.purgeRead") }}
        </UButton>
        <UButton icon="i-lucide-trash-2" color="error" variant="subtle" size="sm" :disabled="writing" @click="askPurge('all')">
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
      v-model:search-by="searchBy"
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
      :type="purgeChoice === 'all' ? 'danger' : 'warning'"
      :title="purgeChoice === 'all' ? t('notifications.history.purgeAllTitle') : t('notifications.history.purgeReadTitle')"
      :description="
        purgeChoice === 'all' ? t('notifications.history.purgeAllDescription') : t('notifications.history.purgeReadDescription')
      "
      @confirm="onPurgeConfirmed"
    />
  </div>
</template>
