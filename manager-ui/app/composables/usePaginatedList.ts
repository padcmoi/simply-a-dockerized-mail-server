export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

// Shared across every list on the site -- a single "items per page"
// preference the user sets once (via ListToolbar) and keeps everywhere,
// persisted with VueUse's useLocalStorage (SSR-safe, syncs from
// localStorage once mounted client-side). Exported so the two pages that
// can't use this composable directly (quotas.vue, useRspamdPage.ts) sync
// to the same key.
export const LIST_LIMIT_STORAGE_KEY = "manager-list-limit";

// Shared fetch+state for every paginated table page (see pagination.validation.ts
// on the API side): builds ?limit=&offset=&search=&sortDir=, unwraps
// { items, total }. `pathOrFn` is a function for domain-scoped routes
// (recipients/aliases/quotas) so it can react to domainStore.selected
// changes -- callers of those still own their own `watch(domainStore.selected, ...)`
// to reset `page` to 1 and reload when the domain changes.
export function usePaginatedList<T>(pathOrFn: string | (() => string | null)) {
  const { call } = useApi();
  const { t } = useI18n();
  const toast = useToast();

  const items = ref<T[]>([]) as Ref<T[]>;
  const total = ref(0);
  const loading = ref(false);
  const page = ref(1);
  const limit = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
  const search = ref("");
  const sortDir = ref<"asc" | "desc">("desc");

  async function load() {
    const path = typeof pathOrFn === "function" ? pathOrFn() : pathOrFn;
    if (!path) return;
    loading.value = true;
    try {
      const qs = new URLSearchParams({
        limit: String(limit.value),
        offset: String((page.value - 1) * limit.value),
        sortDir: sortDir.value,
      });
      if (search.value) qs.set("search", search.value);
      const res = await call<PaginatedResponse<T>>(`${path}?${qs.toString()}`);
      items.value = res.items;
      total.value = res.total;
    } catch {
      toast.add({ title: t("common.failed"), color: "error" });
    } finally {
      loading.value = false;
    }
  }

  const debouncedSearchReload = useDebounceFn(() => {
    page.value = 1;
    load();
  }, 1000);
  watch(search, debouncedSearchReload);
  watch([page, limit, sortDir], load);
  watch(useDataRefresh().tick, load);
  onMounted(load);

  return { items, total, loading, page, limit, search, sortDir, load };
}
