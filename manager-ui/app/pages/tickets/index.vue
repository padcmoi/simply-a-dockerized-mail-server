<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "tickets", action: "access" },
    { resource: "tickets", action: "list-tickets" },
  ],
});

const { t } = useI18n();
const { formatDateTime } = useDateTime();
const { isRoot, hasGlobal } = usePermissions();
const { isOnline } = usePresence();
const { set: setBreadcrumb } = useBreadcrumb();

// Only meaningful for someone who can take a ticket in charge; anyone else has
// nothing assigned, so the filter would just hide their whole list.
const onlyMine = ref(true);
// A ticket whose last message is not the account's own reads like an unread
// message: the row is tinted rather than carrying yet another icon.
const tableMeta = {
  class: { tr: (row: { original: TicketRow }) => (row.original.awaitingMyReply ? "bg-elevated/60" : "") },
};

const canHandle = computed(() => isRoot.value || hasGlobal("tickets", "handle-ticket"));
const canCreate = computed(() => isRoot.value || (hasGlobal("tickets", "access") && hasGlobal("tickets", "create-ticket")));

const SORTABLE_COLUMNS = computed(() => [
  { key: "subject", label: t("tickets.table.subject") },
  { key: "status", label: t("tickets.table.status") },
  { key: "updatedAt", label: t("tickets.table.updated") },
]);

const columns = computed(() => [
  { accessorKey: "subject", header: header("subject", t("tickets.table.subject")) },
  { accessorKey: "domainName", header: t("common.domain") },
  { accessorKey: "status", header: header("status", t("tickets.table.status")) },
  {
    accessorKey: "author",
    header: t("tickets.table.author"),
    meta: { class: { td: "max-w-48 truncate", th: "max-w-48" } },
  },
  { accessorKey: "assignee", header: t("tickets.table.assignee") },
  { accessorKey: "updatedAt", header: header("updatedAt", t("tickets.table.updated")) },
]);

setBreadcrumb([{ label: t("nav.tickets") }]);

const { items, total, loading, hasLoadedOnce, page, limit, search, sortBy, sortDir, load } = usePaginatedList<TicketRow>(
  "tickets-list",
  "/tickets",
  "createdAt",
  [onlyMine],
  () => ({ mine: canHandle.value && onlyMine.value ? "true" : "false" })
);
const UButton = resolveComponent("UButton");
const { header } = useSortableColumns(sortBy, sortDir, UButton);

function open(row: TicketRow) {
  navigateTo(`/tickets/${row.id}`);
}
</script>

<template>
  <div class="p-4 sm:p-6 xl:p-8 space-y-6 min-w-0">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-life-buoy"
      :title="t('tickets.alertTitle')"
      :description="t('tickets.alertDescription')"
    />

    <div v-if="canCreate" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <UCard :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }" @click="navigateTo('/tickets/create')">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-plus" class="text-info text-xl" />
          <span class="font-medium">{{ t("tickets.createTitle") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>
    </div>

    <ListToolbar
      v-model:search="search"
      v-model:limit="limit"
      v-model:sort-by="sortBy"
      v-model:sort-dir="sortDir"
      :total="total"
      :sortable-columns="SORTABLE_COLUMNS"
    >
      <template v-if="canHandle" #filters>
        <UButton
          :color="onlyMine ? 'primary' : 'neutral'"
          :variant="onlyMine ? 'subtle' : 'ghost'"
          icon="i-lucide-user-check"
          :title="t('tickets.table.onlyMine')"
          @click="onlyMine = !onlyMine"
        >
          {{ t("tickets.table.onlyMine") }}
        </UButton>
      </template>
    </ListToolbar>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="6" />

    <template v-else>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hidden lg:block">
        <UTable :columns="columns" :data="items" :loading="loading" sticky :meta="tableMeta">
          <template #subject-cell="{ row }">
            <span class="flex items-center gap-1.5">
              <button class="text-left font-medium text-primary hover:underline" @click="open(row.original)">
                {{ row.original.subject }}
              </button>
              <TicketVisibilityIcon :visibility="row.original.visibility" />
            </span>
          </template>
          <template #domainName-cell="{ row }">
            <span class="text-muted">{{ row.original.domainName ?? "-" }}</span>
          </template>
          <template #status-cell="{ row }">
            <TicketStatusCell :ticket="row.original" @changed="load" />
          </template>
          <template #author-cell="{ row }">
            <span class="block truncate" :class="{ 'text-success': isOnline(row.original.createdBy) }">
              {{ row.original.creatorName ?? row.original.creatorEmail ?? t("tickets.detail.unknown") }}
            </span>
          </template>
          <template #assignee-cell="{ row }">
            <span v-if="row.original.assigneeName ?? row.original.assigneeEmail">{{
              row.original.assigneeName ?? row.original.assigneeEmail
            }}</span>
            <span v-else class="text-dimmed">{{ t("tickets.table.unassigned") }}</span>
          </template>
          <template #updatedAt-cell="{ row }">
            <span class="text-muted">{{ formatDateTime(row.original.updatedAt) }}</span>
          </template>
        </UTable>
      </UCard>

      <div class="lg:hidden space-y-3">
        <p v-if="items.length === 0" class="text-sm text-muted text-center py-6">{{ t("tickets.empty") }}</p>
        <UCard
          v-for="item in items"
          v-else
          :key="item.id"
          :ui="{ root: `transition hover:shadow-md cursor-pointer${item.awaitingMyReply ? ' bg-elevated/60' : ''}` }"
          @click="open(item)"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="flex items-center gap-1.5 min-w-0">
              <span class="font-medium truncate">{{ item.subject }}</span>
              <TicketVisibilityIcon :visibility="item.visibility" />
            </span>
            <TicketStatusCell :ticket="item" @changed="load" />
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{{ item.domainName ?? "-" }}</span>
            <span class="truncate max-w-40" :class="{ 'text-success': isOnline(item.createdBy) }">
              {{ item.creatorName ?? item.creatorEmail ?? t("tickets.detail.unknown") }}
            </span>
            <span>{{ formatDateTime(item.updatedAt) }}</span>
          </div>
        </UCard>
      </div>

      <ListPagination v-model:page="page" :total="total" :limit="limit" />
    </template>
  </div>
</template>
