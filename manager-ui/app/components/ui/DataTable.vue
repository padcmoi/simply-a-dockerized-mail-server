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

// One cell slot per column key plus `actions`, and `filters` for whatever the
// caller wants standing in the toolbar next to the page size.
defineSlots<Record<string, (_props: { row: T }) => unknown> & { filters?: () => unknown }>();

const props = withDefaults(
  defineProps<{
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
    // How many page buttons stand either side of the current one. Two, not one: a pager showing
    // 4 [5] 6 turns every jump of more than one page into a second click, and the first and last
    // chevrons are no help in the middle of a long table.
    siblingCount?: number;
    withSearch?: boolean;
    // A fixed handful of rows that arrive together and are read whole (a domain's own
    // totals, the two bayes statfiles) has nothing to page through, and a pager under
    // one row says "1 of 1" where there was never a second.
    withPagination?: boolean;
    emptyLabel?: string;
  }>(),
  {
    loading: false,
    rowKey: undefined,
    rowClass: undefined,
    pageSizes: () => [10, 25, 50],
    total: null,
    siblingCount: 2,
    withSearch: true,
    withPagination: true,
    emptyLabel: undefined,
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

const root = useTemplateRef<HTMLElement>("root");
const { asTable } = useTableLayout(root);

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
const { serverPaged, searchableColumns, paged, totalRows, pageCount } = useDataTableRows<T>({
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

function applySort(next: { key: string; direction: "asc" | "desc" } | null) {
  sortKey.value = next?.key ?? "";
  if (next) sortDirection.value = next.direction;
}

// Three states and not two: a third click drops the sort and gives the caller's
// own order back, which is the only way to return to it. Except where the rows
// come a page at a time: there the order IS the query, and no order at all would
// be whatever the database felt like handing over.
function toggleSort(key: string) {
  if (sort.value?.key !== key) applySort({ key, direction: "asc" });
  else if (sort.value.direction === "asc") applySort({ key, direction: "desc" });
  else if (!serverPaged.value) applySort(null);
}

function setSortKey(key: string) {
  applySort(key === NO_SORT ? null : { key, direction: sort.value?.direction ?? "asc" });
}

function flipSortDirection() {
  if (!sort.value) return;
  applySort({ key: sort.value.key, direction: sort.value.direction === "asc" ? "desc" : "asc" });
}
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
      @toggle-sort="toggleSort"
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
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps" />
      </template>
    </DataTableBlocks>

    <!-- Always rendered, including on one row and on none. A control that appears and disappears with
         the result count moves everything under it, and a filter that empties the list would take the
         count away at the moment it is most worth reading. -->
    <div v-if="withPagination" class="mt-4 flex flex-col items-center gap-3 @lg:flex-row @lg:justify-between">
      <div class="flex items-center gap-2">
        <UPagination v-model:page="page" :total="totalRows" :items-per-page="limit" :sibling-count="siblingCount" />
        <PageJump v-model:page="page" :pages="pageCount" />
      </div>
      <span class="text-sm text-muted">{{ t("table.count", { shown: paged.length, total: totalRows }) }}</span>
    </div>
  </div>
</template>
