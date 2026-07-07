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
// { items, total }. Built on useAsyncData: `server: false` keeps the exact
// same client-only fetch timing this app already relies on (the auth
// header comes from a Pinia store hydrated client-side, see useApi.ts) --
// `watch` re-runs the fetcher automatically, and Nuxt cancels/dedupes a
// superseded in-flight call itself, so no manual AbortController bookkeeping
// is needed here. `key` must be unique per call site (see call sites for the
// literal strings used). `pathOrFn` is a function for domain-scoped routes
// (recipients/aliases/quotas) so it can react to domainStore.selected.
export function usePaginatedList<T>(key: string, pathOrFn: string | (() => string | null)) {
  const { call } = useApi();
  const { t } = useI18n();
  const toast = useToast();

  const page = ref(1);
  const limit = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
  const search = ref("");
  const debouncedSearch = ref("");
  const sortDir = ref<"asc" | "desc">("desc");

  const applyDebouncedSearch = useDebounceFn(() => {
    page.value = 1;
    debouncedSearch.value = search.value;
  }, 1000);
  watch(search, applyDebouncedSearch);

  const { data, status, refresh } = useAsyncData<PaginatedResponse<T> | null>(
    key,
    async () => {
      const path = typeof pathOrFn === "function" ? pathOrFn() : pathOrFn;
      if (!path) return null;
      const qs = new URLSearchParams({
        limit: String(limit.value),
        offset: String((page.value - 1) * limit.value),
        sortDir: sortDir.value,
      });
      if (debouncedSearch.value) qs.set("search", debouncedSearch.value);
      try {
        return await call<PaginatedResponse<T>>(`${path}?${qs.toString()}`);
      } catch (err) {
        toast.add({ title: t("common.failed"), color: "error" });
        throw err;
      }
    },
    { server: false, watch: [page, limit, sortDir, debouncedSearch, useDataRefresh().tick] }
  );

  const items = computed(() => data.value?.items ?? []);
  const total = computed(() => data.value?.total ?? 0);

  // `hasLoadedOnce` (NOT `items.length === 0`) gates the skeleton: a list
  // that's genuinely empty (0 rows) would otherwise re-show the skeleton on
  // every single page/sort/search reload forever, since `items.length` stays
  // 0 on every subsequent fetch too. It flips true after the very first
  // settle and never reverts, so later reloads always fall through to the
  // real table + its own `:loading` progress bar instead.
  const hasLoadedOnce = ref(false);
  watch(
    status,
    (s) => {
      if (s === "success" || s === "error") hasLoadedOnce.value = true;
    },
    { immediate: true }
  );

  // `loading` only reflects an in-flight fetch (used for the refresh button
  // spinner and UTable's built-in progress bar) -- NOT "idle", unlike the
  // skeleton gate above, since once `hasLoadedOnce` is true the skeleton is
  // gone and only this drives feedback during reloads.
  const loading = computed(() => status.value === "pending");

  return { items, total, loading, hasLoadedOnce, page, limit, search, sortDir, load: refresh };
}
