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
// nothing assigned, so the filter would just hide their whole list. Kept in
// localStorage: whoever works the queue reads it the same way every day, and
// having to press the filter again on every visit is the annoyance. On by
// default, so a first visit still opens on one's own tickets.
const ONLY_MINE_STORAGE_KEY = "manager-tickets-only-mine";
const onlyMine = useLocalStorage(ONLY_MINE_STORAGE_KEY, true);

// Kept the same way, and on by default: a closed ticket is a conversation
// nobody is going to answer again, so the file opens on what is still live.
// Turning it off brings the closed ones back.
const HIDE_CLOSED_STORAGE_KEY = "manager-tickets-hide-closed";
const hideClosed = useLocalStorage(HIDE_CLOSED_STORAGE_KEY, true);
// A ticket whose last message is not the account's own reads like an unread
// message: the row is tinted rather than carrying yet another icon. Handed to
// DataTable, so the table row and the block are marked the same way.
// Both filters send the reader back to the first page: staying on page 4 of a
// list that just lost half its rows lands on an empty table.
function toggleOnlyMine() {
  onlyMine.value = !onlyMine.value;
  page.value = 1;
}

function toggleHideClosed() {
  hideClosed.value = !hideClosed.value;
  page.value = 1;
}

function rowClass(row: TicketRow) {
  return row.awaitingMyReply ? "bg-elevated/60" : "";
}

const canHandle = computed(() => isRoot.value || hasGlobal("tickets", "handle-ticket"));
const canCreate = computed(() => isRoot.value || (hasGlobal("tickets", "access") && hasGlobal("tickets", "create-ticket")));

// Declared once for both renderings, which DataTable chooses between on its own
// width. Author and assignee are resolved after the query and the API has no
// column to order them by, hence the two that say so.
const columns = computed<DataTableColumn<TicketRow>[]>(() => [
  { key: "subject", label: t("tickets.table.subject"), value: (row) => row.subject, primary: true },
  { key: "domainName", label: t("common.domain"), value: (row) => row.domainName ?? "" },
  { key: "status", label: t("tickets.table.status"), value: (row) => row.status },
  {
    key: "author",
    label: t("tickets.table.author"),
    value: (row) => row.creatorName ?? row.creatorEmail ?? "",
    sortable: false,
    class: "max-w-48 truncate",
  },
  {
    key: "assignee",
    label: t("tickets.table.assignee"),
    value: (row) => row.assigneeName ?? row.assigneeEmail ?? "",
    sortable: false,
  },
  { key: "updatedAt", label: t("tickets.table.updated"), value: (row) => row.updatedAt },
]);

setBreadcrumb([{ label: t("nav.tickets") }]);

const { items, total, loading, hasLoadedOnce, page, limit, search, sortBy, sortDir, load } = usePaginatedList<TicketRow>(
  "tickets-list",
  "/tickets",
  "createdAt",
  [onlyMine, hideClosed],
  () => ({
    mine: canHandle.value && onlyMine.value ? "true" : "false",
    hideClosed: hideClosed.value ? "true" : "false",
  })
);

function open(row: TicketRow) {
  navigateTo(`/admin/tickets/${row.id}`);
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
      <UCard :ui="{ root: 'transition hover:shadow-lg cursor-pointer' }" @click="navigateTo('/admin/tickets/create')">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-plus" class="text-info text-xl" />
          <span class="font-medium">{{ t("tickets.createTitle") }}</span>
          <UIcon name="i-lucide-arrow-right" class="ml-auto text-muted" />
        </div>
      </UCard>
    </div>

    <ListSkeleton v-if="!hasLoadedOnce" :columns="6" />

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
      :row-key="(row: TicketRow) => row.id"
      :row-class="rowClass"
      :empty-label="t('tickets.empty')"
    >
      <template #filters>
        <UButton
          :color="hideClosed ? 'primary' : 'neutral'"
          :variant="hideClosed ? 'subtle' : 'ghost'"
          icon="i-lucide-eye-off"
          :title="t('tickets.table.hideClosed')"
          @click="toggleHideClosed"
        >
          {{ t("tickets.table.hideClosed") }}
        </UButton>

        <UButton
          v-if="canHandle"
          :color="onlyMine ? 'primary' : 'neutral'"
          :variant="onlyMine ? 'subtle' : 'ghost'"
          icon="i-lucide-user-check"
          :title="t('tickets.table.onlyMine')"
          @click="toggleOnlyMine"
        >
          {{ t("tickets.table.onlyMine") }}
        </UButton>
      </template>

      <template #subject="{ row }">
        <span class="flex items-center gap-1.5 min-w-0">
          <button class="text-left font-medium text-primary hover:underline truncate min-w-0" @click="open(row)">
            {{ row.subject }}
          </button>
          <TicketVisibilityIcon :visibility="row.visibility" />
        </span>
      </template>

      <template #domainName="{ row }">
        <TicketDomainCell :domain-name="row.domainName" :recipients="row.recipients ?? []" :aliases="row.aliases ?? []" />
      </template>

      <template #status="{ row }">
        <TicketStatusCell :ticket="row" @changed="load" />
      </template>

      <template #author="{ row }">
        <span class="block truncate" :class="{ 'text-success': isOnline(row.createdBy) }">
          {{ row.creatorName ?? row.creatorEmail ?? t("tickets.detail.unknown") }}
        </span>
      </template>

      <template #assignee="{ row }">
        <span v-if="row.assigneeName ?? row.assigneeEmail">{{ row.assigneeName ?? row.assigneeEmail }}</span>
        <span v-else class="text-dimmed">{{ t("tickets.table.unassigned") }}</span>
      </template>

      <template #updatedAt="{ row }">
        <span class="text-muted">{{ formatDateTime(row.updatedAt) }}</span>
      </template>
    </DataTable>
  </div>
</template>
