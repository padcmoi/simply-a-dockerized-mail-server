import type { RspamdHistoryRow } from "./useDomainDashboard";

export interface RspamdActions {
  reject: number;
  "soft reject": number;
  "rewrite subject": number;
  "add header": number;
  greylist: number;
  "no action": number;
}

export interface RspamdStats {
  scanned: number;
  actions: RspamdActions;
}

export interface RspamdHistoryItem {
  id: string;
  sender_smtp: string;
  rcpt: string;
  action: string;
  score: number;
  required_score: number;
  size: number;
  time: string;
}

export function rspamdActionColor(action: string) {
  if (action === "no action") return "success";
  if (action === "reject") return "error";
  if (action === "greylist") return "info";
  return "warning";
}

// `domainId` absent -> server-wide /rspamd/*; present -> the identical
// /domains/:id/rspamd/* endpoints, filtered to that domain's recipients.
// Both pages (rspamd.vue, domains/[domain]/rspamd.vue) share this one
// composable so they stay exact twins by construction, not by convention.
export function useRspamdPage(domainId?: Ref<number | null>) {
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

  // Domain-scoped pages set their own (domain-aware) breadcrumb themselves,
  // matching every other page under domains/[domain]/ -- see quotas.vue.
  if (!domainId) setBreadcrumb([{ label: t("nav.rspamd") }]);

  const basePath = computed(() => (domainId ? `/domains/${domainId.value}/rspamd` : "/rspamd"));
  // Static per call-site (not reactive on domainId's value): keeps the two
  // pages' useAsyncData entries from colliding in Nuxt's payload cache --
  // switching between them client-side must never flash the other scope's
  // stale data -- while still sharing one key across a domain slug change,
  // same tradeoff useCurrentDomain.ts's own "current-domain-resolve" makes.
  const keyPrefix = domainId ? "domain-rspamd" : "rspamd";

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
  } = useAsyncData<RspamdStats | null>(
    `${keyPrefix}-stats`,
    async () => {
      if (domainId) await until(domainId).toBeTruthy();
      return call<RspamdStats>(`${basePath.value}/stats`).catch(() => null);
    },
    { server: false, watch: domainId ? [domainId, tick] : [tick], default: () => null }
  );

  // `size=200` bounds how many rows Rspamd's own ring buffer gives us before
  // our search/pagination/sortDir apply in-memory server-side (see
  // rspamd.service.ts) -- there's no deeper archive to page into.
  const {
    data: historyData,
    status: historyStatus,
    refresh: refreshHistory,
  } = useAsyncData<{ items: RspamdHistoryRow[]; total: number }>(
    `${keyPrefix}-history`,
    async () => {
      if (domainId) await until(domainId).toBeTruthy();
      const qs = new URLSearchParams({
        size: "200",
        limit: String(limit.value),
        offset: String((page.value - 1) * limit.value),
        sortDir: sortDir.value,
        sortBy: sortBy.value,
      });
      if (debouncedSearch.value) qs.set("search", debouncedSearch.value);
      return call<{ items: RspamdHistoryRow[]; total: number }>(`${basePath.value}/history?${qs.toString()}`);
    },
    {
      server: false,
      watch: domainId
        ? [domainId, page, limit, sortBy, sortDir, debouncedSearch, tick]
        : [page, limit, sortBy, sortDir, debouncedSearch, tick],
      default: () => ({ items: [], total: 0 }),
    }
  );

  const stats = computed(() => statsData.value);
  const statsUnavailable = computed(() => statsStatus.value === "success" && !statsData.value);
  const history = computed(() => historyData.value?.items ?? []);
  const total = computed(() => historyData.value?.total ?? 0);

  // Shared row shape feeding both the desktop table and the mobile/tablet
  // card list (RspamdHistoryCard.vue) on both pages.
  const historyItems = computed<RspamdHistoryItem[]>(() =>
    history.value.map((r) => ({
      id: r["message-id"],
      sender_smtp: r.sender_smtp,
      rcpt: r.rcpt_smtp?.join(", ") ?? "",
      action: r.action,
      score: r.score,
      required_score: r.required_score,
      size: r.size,
      time: new Date(r.unix_time * 1000).toLocaleString(),
    }))
  );

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
    historyItems,
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
