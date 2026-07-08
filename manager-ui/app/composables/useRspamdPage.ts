import type { RspamdHistoryRow } from "./useDomainDashboard";

export interface RspamdStats {
  version: string;
  uptime: number;
  scanned: number;
  learned: number;
  spam_count: number;
  ham_count: number;
  connections: number;
  actions: {
    reject: number;
    "soft reject": number;
    "rewrite subject": number;
    "add header": number;
    greylist: number;
    "no action": number;
  };
}

export function rspamdActionColor(action: string) {
  if (action === "no action") return "success";
  if (action === "reject") return "error";
  if (action === "greylist") return "info";
  return "warning";
}

export function useRspamdPage() {
  const page = ref(1);
  const limit = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
  const search = ref("");
  const debouncedSearch = ref("");
  const sortBy = ref("time");
  const sortDir = ref<"asc" | "desc">("desc");

  const { call } = useApi();
  const { set: setBreadcrumb } = useBreadcrumb();
  const { t } = useI18n();
  const { tick } = useDataRefresh();

  setBreadcrumb([{ label: t("nav.rspamd") }]);

  const applyDebouncedSearch = useDebounceFn(() => {
    page.value = 1;
    debouncedSearch.value = search.value;
  }, 1000);
  watch(search, applyDebouncedSearch);

  // Two independent useAsyncData calls: stats rarely change and don't
  // depend on pagination; history does. Nuxt cancels/dedupes a superseded
  // in-flight call itself when `watch` fires again, so no manual
  // AbortController bookkeeping is needed (see usePaginatedList.ts).
  const {
    data: statsData,
    status: statsStatus,
    refresh: refreshStats,
  } = useAsyncData<RspamdStats | null>("rspamd-stats", () => call<RspamdStats>("/rspamd/stats").catch(() => null), {
    server: false,
    watch: [tick],
  });

  // `size=200` bounds how many rows Rspamd's own ring buffer gives us before
  // our search/pagination/sortDir apply in-memory server-side (see
  // rspamd.service.ts) -- there's no deeper archive to page into.
  const {
    data: historyData,
    status: historyStatus,
    refresh: refreshHistory,
  } = useAsyncData<{ items: RspamdHistoryRow[]; total: number }>(
    "rspamd-history",
    () => {
      const qs = new URLSearchParams({
        size: "200",
        limit: String(limit.value),
        offset: String((page.value - 1) * limit.value),
        sortDir: sortDir.value,
        sortBy: sortBy.value,
      });
      if (debouncedSearch.value) qs.set("search", debouncedSearch.value);
      return call<{ items: RspamdHistoryRow[]; total: number }>(`/rspamd/history?${qs.toString()}`);
    },
    {
      server: false,
      watch: [page, limit, sortBy, sortDir, debouncedSearch, tick],
      default: () => ({ items: [], total: 0 }),
    }
  );

  const stats = computed(() => statsData.value);
  const statsUnavailable = computed(() => statsStatus.value === "success" && !statsData.value);
  const history = computed(() => historyData.value?.items ?? []);
  const total = computed(() => historyData.value?.total ?? 0);

  // `historyHasLoadedOnce` (NOT `history.length === 0`) gates the history
  // skeleton: a genuinely empty history would otherwise re-show the
  // skeleton on every page/sort/search reload forever, since `history.length`
  // stays 0 on every subsequent fetch too. It flips true after the very
  // first settle and never reverts (see usePaginatedList.ts for the same
  // pattern). The stats card doesn't need this: `stats` is a single object
  // that, once populated, stays populated across reloads (a real "gone
  // missing again" case is what `statsUnavailable` already covers).
  const historyHasLoadedOnce = ref(false);
  watch(
    historyStatus,
    (s) => {
      if (s === "success" || s === "error") historyHasLoadedOnce.value = true;
    },
    { immediate: true }
  );

  const statsLoading = computed(() => statsStatus.value === "pending");
  const historyLoading = computed(() => historyStatus.value === "pending");
  const loading = computed(() => statsLoading.value || historyLoading.value);

  async function load() {
    await Promise.all([refreshStats(), refreshHistory()]);
  }

  return {
    stats,
    history,
    total,
    loading,
    historyLoading,
    historyHasLoadedOnce,
    statsUnavailable,
    page,
    limit,
    search,
    sortBy,
    sortDir,
    load,
  };
}
