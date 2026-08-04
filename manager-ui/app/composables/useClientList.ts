// Client-side twin of usePaginatedList for the rare list whose full dataset
// is already in memory (the personal-space overview returns every owned
// recipient and alias in one payload). Returns the exact same shape a page
// wires ListToolbar / UTable / ListPagination against -- items, total, page,
// limit, search, sortBy, sortDir -- but filters, sorts and paginates the array
// locally instead of refetching. `loading` and `hasLoadedOnce` are not owned
// here: the single overview fetch drives them, and the page passes them down.
export function useClientList<T>(source: Ref<T[]>, searchKeys: (keyof T)[], defaultSortBy: keyof T & string) {
  const page = ref(1);
  const limit = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
  const search = ref("");
  const sortBy = ref<string>(defaultSortBy);
  const sortDir = ref<"asc" | "desc">("asc");

  watch([search, limit, sortBy, sortDir], () => {
    page.value = 1;
  });

  const filtered = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return source.value;
    return source.value.filter((row) =>
      searchKeys.some((k) =>
        String(row[k] ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  });

  const sorted = computed(() => {
    const key = sortBy.value as keyof T;
    const dir = sortDir.value === "asc" ? 1 : -1;
    return [...filtered.value].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  });

  const total = computed(() => sorted.value.length);

  const items = computed(() => {
    const start = (page.value - 1) * limit.value;
    return sorted.value.slice(start, start + limit.value);
  });

  watch([total, limit], () => {
    const maxPage = Math.max(1, Math.ceil(total.value / limit.value));
    if (page.value > maxPage) page.value = maxPage;
  });

  return { items, total, page, limit, search, sortBy, sortDir };
}
