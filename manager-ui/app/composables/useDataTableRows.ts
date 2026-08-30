// Turning a collection into the rows on screen: search, sort, page. It is the
// half of DataTable that has nothing to do with rendering, and it answers the
// same way whether the list is a table or a stack of blocks.
//
// SERVER PAGING is the one branch that runs through all of it. When the caller
// hands over a page rather than a collection, filtering and sorting here would
// only ever reach the rows already on screen, so both are handed up through the
// models and answered by a fetch, and the page must not be cut a second time.

export const ALL_COLUMNS = "*";

function isBlank(value: unknown) {
  return value === null || value === undefined || value === "";
}

export function useDataTableRows<T>(options: {
  data: () => T[];
  columns: () => DataTableColumn<T>[];
  searchTerm: () => string;
  scope: () => string;
  sort: () => { key: string; direction: "asc" | "desc" } | null;
  page: Ref<number>;
  limit: () => number;
  total: () => number | null;
}) {
  const { locale } = useI18n();

  const serverPaged = computed(() => options.total() !== null);
  const searchableColumns = computed(() => options.columns().filter((column) => column.searchable !== false));

  function compare(a: unknown, b: unknown) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
    // The active locale and not the runtime's: Node and the browser would
    // otherwise be free to order the same two names differently, and the
    // server's markup has to survive hydration untouched.
    return String(a).localeCompare(String(b), locale.value.replace("_", "-"), { numeric: true, sensitivity: "base" });
  }

  const filtered = computed(() => {
    const term = options.searchTerm().trim().toLowerCase();
    if (serverPaged.value || !term) return options.data();

    const scoped =
      options.scope() === ALL_COLUMNS
        ? searchableColumns.value
        : searchableColumns.value.filter((column) => column.key === options.scope());

    return options.data().filter((row) => scoped.some((column) => dataTableText(column, row).toLowerCase().includes(term)));
  });

  // Sorted after filtering and over a copy: the data belongs to the caller.
  const sorted = computed(() => {
    if (serverPaged.value) return filtered.value;

    const active = options.sort();
    const column = active ? options.columns().find((candidate) => candidate.key === active.key) : undefined;
    if (!active || !column) return filtered.value;

    const direction = active.direction === "asc" ? 1 : -1;
    return [...filtered.value].sort((left, right) => {
      const a = column.value(left);
      const b = column.value(right);
      // Blanks sink whichever way the column is sorted: they are an absence, not
      // a value that happens to come first alphabetically.
      const aBlank = isBlank(a);
      const bBlank = isBlank(b);
      if (aBlank || bBlank) return aBlank && bBlank ? 0 : aBlank ? 1 : -1;
      return compare(a, b) * direction;
    });
  });

  // In server mode the caller already cut the page, so cutting it again would
  // show the first ten rows of a window of twenty-five and hide the rest behind
  // a pager that cannot reach them.
  const paged = computed(() =>
    serverPaged.value
      ? sorted.value
      : sorted.value.slice((options.page.value - 1) * options.limit(), options.page.value * options.limit())
  );
  const totalRows = computed(() => options.total() ?? sorted.value.length);
  const pageCount = computed(() => Math.max(1, Math.ceil(totalRows.value / Math.max(options.limit(), 1))));

  // A narrowed result can leave the current page past the end of it, which
  // paints an empty list over one that has matches.
  //
  // The row count is watched only in local mode: in server mode every page
  // arrives as a new array and often a different length, so resetting on it
  // would send the reader back to page one exactly when the page they asked for
  // lands.
  watch([options.searchTerm, options.scope, options.limit, () => (serverPaged.value ? 0 : options.data().length)], () => {
    options.page.value = 1;
  });

  return { serverPaged, searchableColumns, filtered, sorted, paged, totalRows, pageCount };
}
