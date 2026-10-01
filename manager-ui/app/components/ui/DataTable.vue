<script setup lang="ts" generic="T">
// One list, two renderings, one set of cell templates. This file is the wrapper and owns neither
// rendering: it holds what they SHARE and hands the rows to whichever one fits.
//
//   ui/datatable-render/DataTableNative.vue  the wide one, a real table with clickable headers
//   ui/datatable-render/DataTableBlocks.vue  the narrow one, a block per row
//
// Search, scope, sort, paging and the toolbar live here, so both renderings answer the same state and
// a caller declares its columns once. Everything below is decided over the rows handed in; that holds
// for as long as the caller can fetch its collection in one go, and when it cannot, what changes is the
// caller and its endpoint, not this contract.
//
// ONE of the two is in the DOM, never both. Hiding the loser in CSS was cheap to write and it cost
// every reader the whole list twice: twice the nodes, twice the cell slots, twice the formatting work
// on every keystroke, sort and page change. A desktop absorbs that; a phone is exactly the device that
// pays for it and exactly the one that only ever sees the blocks.
//
// The choice is `useTableLayout`, measuring the width of the box THIS COMPONENT was given, not the
// window: a sidebar, an open devtools pane or a two-column layout all leave the viewport wide while
// handing this 500px, and a viewport breakpoint would keep the table in a box it cannot fit.
//
// Nothing has been measured on the server, so the first paint is the blocks, and a wide window swaps to
// the table on mount. That way round and not the other: the narrow rendering is both the safe one to be
// wrong with and the right one for the device least able to afford a swap.
// One cell slot per column key, plus `actions`. Declared with an index signature because the keys are
// the caller's columns: what it buys is the row's own type inside those templates, which is the other
// half of typing the accessor. They are forwarded whole to whichever rendering is up.
// Bindable, so a caller paging on the server owns them. Unbound they behave as plain local state,
// which is the case for every list that hands over its whole collection.
const page = defineModel<number>("page", { default: 1 });
const limit = defineModel<number>("pageSize", { default: 10 });
// What is being looked for and how the list is ordered, bindable for the same
// reason: a caller whose rows come a page at a time asks its API for them, so it
// is the one that has to know. Unbound, both are local state and this component
// searches and sorts the collection it was handed.
const search = defineModel<string>("search", { default: "" });
// Which column the term is matched against, `ALL_COLUMNS` for every one of them.
// Bindable like the term itself: a caller whose rows come a page at a time is
// the one that has to put it on the query, since the matching happens over
// there. Unbound it is local state and this component narrows its own filter.
const searchBy = defineModel<string>("searchBy", { default: ALL_COLUMNS });
// Empty rather than null: a caller's own sort key is a plain string, and a model
// that could be null would not bind to it.
const sortKey = defineModel<string>("sortKey", { default: "" });
const sortDirection = defineModel<"asc" | "desc">("sortDirection", { default: "asc" });
// The keys of the rows ticked, kept across pages and reloads: a key stays until
// its box is unticked or the caller clears the selection.
const selected = defineModel<(string | number)[]>("selected", { default: () => [] });

// One cell slot per column key plus `actions`, and `filters` for whatever the
// caller wants standing in the toolbar next to the page size.
defineSlots<
  Record<string, (_props: { row: T }) => unknown> & {
    filters?: () => unknown;
    selection?: (_props: { keys: (string | number)[]; rows: T[]; clear: () => void }) => unknown;
  }
>();

const props = withDefaults(
  defineProps<{
    // Names this table in the browser's storage: its page size is kept under
    // it, so every table remembers its own choice.
    tableId: string;
    data: T[];
    columns: DataTableColumn<T>[];
    loading?: boolean;
    // Stable identity for the block list's `:key`. Without one the index stands
    // in, which is enough for rows that carry no state of their own.
    rowKey?: (_row: T) => string | number;
    // A row that has to stand out from its neighbours (an unread thread, a
    // disabled account). Given here rather than written into a cell, so the
    // table row and the block carry the same mark.
    rowClass?: (_row: T) => string;
    pageSizes?: number[];
    // SERVER PAGING, opt in. Left null, this component holds the whole collection and cuts it into
    // pages itself, which is what every list in this app but one does. Given a total, it stops
    // cutting: `data` IS the page, the pager counts against the total and the caller answers
    // `update:page` by fetching the next window. A table of a hundred thousand production rows is
    // not loaded into a tab to be paged in it.
    total?: number | null;
    withSearch?: boolean;
    // A fixed handful of rows that arrive together and are read whole (a domain's own
    // totals, the two bayes statfiles) has nothing to page through, and a pager under
    // one row says "1 of 1" where there was never a second.
    withPagination?: boolean;
    emptyLabel?: string;
    // Multiple selection, off unless asked for: a box per row and one for the
    // page. Needs `rowKey`: the selection is a list of keys, which is what lets
    // it outlive a page change. What is done with it is the caller's, through
    // the `selection` slot or `v-model:selected`.
    multiple?: boolean;
    // Which rows may be ticked, all of them when left out: a row the caller
    // never acts on in bulk (a system mailbox) gets no box.
    rowSelectable?: (_row: T) => boolean;
    // Where the bar holding the `selection` slot stands, shown only while
    // something is ticked.
    selectionPosition?: "top" | "bottom";
  }>(),
  {
    loading: false,
    rowKey: undefined,
    rowClass: undefined,
    pageSizes: () => [10, 25, 50],
    total: null,
    withSearch: true,
    withPagination: true,
    emptyLabel: undefined,
    multiple: false,
    rowSelectable: undefined,
    selectionPosition: "top",
  }
);

// Both selects need a value standing for "no column", and neither may spell it
// as the empty string: the underlying Reka UI `SelectItem` reserves that for
// clearing a selection and THROWS on an item carrying it. The assertion runs on
// mount, in the browser only, so an empty string here renders a perfectly clean
// page server-side and takes the app down on hydration.
const NO_SORT = "__none__";
const SEARCH_DEBOUNCE_MS = 300;

const { t } = useI18n();

const storedPageSize = useTablePageSize(props.tableId);
// The width the table needed the last time it did not fit its box. A table
// wider than its box would scroll sideways, so it gives way to the cards until
// the box is that wide again.
const overflowWidth = ref(0);
const seenRows = shallowRef(new Map<string | number, T>());

const root = useTemplateRef<HTMLElement>("root");
const { asTable: wideEnough, width } = useTableLayout(root);
const asTable = computed(() => wideEnough.value === true && width.value >= overflowWidth.value);
const { showEdges, siblingCount } = usePagerLayout(width);

// The field writes `search` on every keystroke, so what was typed appears at
// once and a caller fetching over the network sees it as it is typed and applies
// its own pace. This is the one the LOCAL filter reads: every keystroke would
// otherwise rebuild the filtered list, sort it and re-render the whole thing, and
// a held-down key would do it per repeat.
const searchTerm = refDebounced(search, SEARCH_DEBOUNCE_MS);

const sort = computed(() => (sortKey.value ? { key: sortKey.value, direction: sortDirection.value } : null));

// Search, sort and paging live in a composable of their own: they are the half
// of this component that has nothing to do with rendering, and both renderings
// answer the same state.
const { searchableColumns, paged, totalRows, pageCount } = useDataTableRows<T>({
  data: () => props.data,
  columns: () => props.columns,
  searchTerm: () => searchTerm.value,
  scope: () => searchBy.value,
  sort: () => sort.value,
  page,
  limit: () => limit.value,
  total: () => props.total,
});

const sortableColumns = computed(() => props.columns.filter((column) => column.sortable !== false));

const canSelect = computed(() => props.multiple && !!props.rowKey);
const selectedSet = computed(() => new Set(selected.value));
const pageKeys = computed(() => {
  const rowKey = props.rowKey;
  if (!canSelect.value || !rowKey) return [];
  return paged.value.filter((row) => props.rowSelectable?.(row) ?? true).map(rowKey);
});
const pageSelection = computed(() => pageSelectionState(selected.value, pageKeys.value));
const selectedRows = computed(() =>
  selected.value.flatMap((key) => {
    const row = seenRows.value.get(key);
    return row === undefined ? [] : [row];
  })
);

const scopeItems = computed(() => [
  { label: t("table.allColumns"), value: ALL_COLUMNS },
  ...searchableColumns.value.map((column) => ({ label: column.label, value: dataTableSearchKey(column) })),
]);

// A table whose search reaches a single column has nothing to narrow: the choice
// would be between "everywhere" and the one place, which are the same answer.
const withSearchScope = computed(() => searchableColumns.value.length > 1);

const sortItems = computed(() => [
  { label: t("table.noSort"), value: NO_SORT },
  ...sortableColumns.value.map((column) => ({ label: column.label, value: column.key })),
]);

watch(
  () => props.data,
  (rows) => {
    if (!canSelect.value || !props.rowKey) return;
    const next = new Map(seenRows.value);
    const barred = new Set<string | number>();
    for (const row of rows) {
      const key = props.rowKey(row);
      next.set(key, row);
      if (!(props.rowSelectable?.(row) ?? true)) barred.add(key);
    }
    seenRows.value = next;
    if (barred.size && selected.value.some((key) => barred.has(key))) {
      selected.value = selected.value.filter((key) => !barred.has(key));
    }
  },
  { immediate: true }
);

watch([asTable, paged, () => props.columns], measureOverflow, { flush: "post" });

watch(limit, (size) => {
  if (size !== storedPageSize.value) storedPageSize.value = size;
});

function applySort(next: { key: string; direction: "asc" | "desc" } | null) {
  sortKey.value = next?.key ?? "";
  if (next) sortDirection.value = next.direction;
}

function toggleSort(key: string) {
  if (sort.value?.key !== key) applySort({ key, direction: "asc" });
  else applySort({ key, direction: sort.value.direction === "asc" ? "desc" : "asc" });
}

function measureOverflow() {
  if (!asTable.value) return;
  const table = root.value?.querySelector("table");
  const box = table?.parentElement;
  if (table && box && table.scrollWidth > box.clientWidth + 1)
    overflowWidth.value = width.value + table.scrollWidth - box.clientWidth;
}

function isSelected(row: T) {
  return !!props.rowKey && selectedSet.value.has(props.rowKey(row));
}

function canTick(row: T) {
  return props.rowSelectable?.(row) ?? true;
}

function toggleRow(row: T, ticked: boolean) {
  if (!props.rowKey || !canTick(row)) return;
  selected.value = toggleKeys(selected.value, [props.rowKey(row)], ticked);
}

function togglePage(ticked: boolean) {
  selected.value = toggleKeys(selected.value, pageKeys.value, ticked);
}

function clearSelection() {
  selected.value = [];
}

function setSortKey(key: string) {
  applySort(key === NO_SORT ? null : { key, direction: sort.value?.direction ?? "asc" });
}

function flipSortDirection() {
  if (!sort.value) return;
  applySort({ key: sort.value.key, direction: sort.value.direction === "asc" ? "desc" : "asc" });
}

onMounted(() => {
  if (props.pageSizes.includes(storedPageSize.value) && limit.value !== storedPageSize.value) limit.value = storedPageSize.value;
});
</script>

<template>
  <!-- `@container` is still here and no longer decides the rendering: what is left of it is the
       toolbar's own reflow below, which has to answer to this box's width for the same reason. -->
  <div ref="root" class="@container min-w-0">
    <div v-if="withSearch" class="mb-4 flex flex-col gap-3 @5xl:flex-row @5xl:items-center @5xl:justify-between">
      <div class="flex flex-col gap-2 @lg:flex-row @lg:items-center">
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('common.search')" class="w-full @lg:w-64" />
        <!-- Which column the term is matched against, wherever the matching
             happens: this component narrows its own filter, and a caller
             searching over the network carries the choice on its query. -->
        <USelect
          v-if="withSearchScope"
          v-model="searchBy"
          :items="scopeItems"
          icon="i-lucide-filter"
          class="w-full @lg:w-56"
          :aria-label="t('table.searchIn')"
        />
      </div>

      <div class="flex flex-col gap-2 @lg:flex-row @lg:items-center">
        <!-- The blocks have no headers to click, so the sort they share with the
             table needs a control of its own down here. -->
        <div v-if="!asTable" class="flex items-center gap-2">
          <USelect
            :model-value="sort?.key ?? NO_SORT"
            :items="sortItems"
            icon="i-lucide-arrow-up-down"
            class="w-full"
            :aria-label="t('table.sortBy')"
            @update:model-value="setSortKey(String($event))"
          />
          <UButton
            color="neutral"
            variant="subtle"
            :disabled="!sort"
            :icon="sort?.direction === 'desc' ? 'i-lucide-arrow-down-wide-narrow' : 'i-lucide-arrow-up-narrow-wide'"
            :aria-label="t(sort?.direction === 'desc' ? 'table.descending' : 'table.ascending')"
            @click="flipSortDirection"
          />
        </div>

        <slot name="filters" />

        <USelect v-model="limit" :items="pageSizes" class="w-full @lg:w-24" :aria-label="t('table.perPage')" />
      </div>
    </div>

    <div
      v-if="canSelect && selected.length && selectionPosition === 'top'"
      class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2"
    >
      <span class="text-sm font-medium">{{ t("table.selected", { count: selected.length }) }}</span>
      <UButton color="neutral" variant="link" size="xs" icon="i-lucide-x" @click="clearSelection">
        {{ t("table.clearSelection") }}
      </UButton>
      <div class="flex flex-wrap items-center gap-2 @lg:ms-auto">
        <slot name="selection" :keys="selected" :rows="selectedRows" :clear="clearSelection" />
      </div>
    </div>

    <div v-if="canSelect && !asTable && pageKeys.length" class="mb-3 flex items-center gap-2 px-1">
      <UCheckbox :model-value="pageSelection" :label="t('table.selectPage')" @update:model-value="togglePage($event === true)" />
    </div>

    <!-- The caller's cell templates are forwarded WHOLE rather than listed here: the slot names are
         the caller's own column keys, so naming them would mean this wrapper knowing them. -->
    <DataTableNative
      v-if="asTable"
      :rows="paged"
      :columns="columns"
      :loading="loading"
      :sort="sort"
      :row-class="rowClass"
      :empty-label="emptyLabel"
      :selectable="canSelect"
      :is-selected="isSelected"
      :can-tick="canTick"
      :page-selection="pageSelection"
      @toggle-sort="toggleSort"
      @toggle-row="toggleRow"
      @toggle-page="togglePage"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps" />
      </template>
    </DataTableNative>

    <DataTableBlocks
      v-else
      :rows="paged"
      :columns="columns"
      :loading="loading"
      :row-key="rowKey"
      :row-class="rowClass"
      :empty-label="emptyLabel"
      :selectable="canSelect"
      :is-selected="isSelected"
      :can-tick="canTick"
      @toggle-row="toggleRow"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps" />
      </template>
    </DataTableBlocks>

    <div
      v-if="canSelect && selected.length && selectionPosition === 'bottom'"
      class="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2"
    >
      <span class="text-sm font-medium">{{ t("table.selected", { count: selected.length }) }}</span>
      <UButton color="neutral" variant="link" size="xs" icon="i-lucide-x" @click="clearSelection">
        {{ t("table.clearSelection") }}
      </UButton>
      <div class="flex flex-wrap items-center gap-2 @lg:ms-auto">
        <slot name="selection" :keys="selected" :rows="selectedRows" :clear="clearSelection" />
      </div>
    </div>

    <!-- Always rendered, including on one row and on none. A control that appears and disappears with
         the result count moves everything under it, and a filter that empties the list would take the
         count away at the moment it is most worth reading. -->
    <div v-if="withPagination" class="mt-4 flex flex-wrap items-center justify-center gap-3 @lg:justify-between">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <UPagination
          v-model:page="page"
          :total="totalRows"
          :items-per-page="limit"
          :sibling-count="siblingCount"
          :show-edges="showEdges"
        />
        <PageJump v-model:page="page" :pages="pageCount" />
      </div>
      <span class="text-sm text-muted">{{ t("table.count", { shown: paged.length, total: totalRows }) }}</span>
    </div>
  </div>
</template>
