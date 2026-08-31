export function rspamdActionColor(action: string) {
  if (action === "no action") return "success";
  if (action === "reject") return "error";
  if (action === "greylist") return "info";
  return "warning";
}

// The one colour each verdict wears, wherever it is read: the donut slice, its
// legend dot and the counter tile. A tile at zero has no slice to be read
// against, so it carries the colour all the same. Classes are written out
// rather than built from the token, since a class assembled at runtime is a
// class the stylesheet never hears about.
export const RSPAMD_ACTION_STYLE = {
  "no action": { chart: "success", text: "text-success", dot: "bg-success" },
  greylist: { chart: "primary", text: "text-primary", dot: "bg-primary" },
  "add header": { chart: "warning", text: "text-warning", dot: "bg-warning" },
  "rewrite subject": { chart: "warning", text: "text-warning", dot: "bg-warning" },
  "soft reject": { chart: "warning", text: "text-warning", dot: "bg-warning" },
  reject: { chart: "error", text: "text-error", dot: "bg-error" },
} as const satisfies Record<keyof RspamdActions, { chart: string; text: string; dot: string }>;

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

  // Stats come over WS: the global page from the "rspamd-stats" topic, a domain
  // page from "domain-rspamd:<id>" (see the matching watchers). The domain page
  // keeps its REST call as the fallback until the first WS frame (and for
  // accounts a domain-scoped subscription can't reach); the global page is
  // WS-only. `realtimeStats` follows the resolved topic reactively.
  const realtimeStats = useRealtimeTopic<RspamdStats>(() =>
    domainId ? (domainId.value ? `domain-rspamd:${domainId.value}` : null) : "rspamd-stats"
  );
  const {
    data: statsData,
    status: statsStatus,
    refresh: refreshStats,
  } = useAsyncData<RspamdStats | null>(
    `${keyPrefix}-stats`,
    async () => {
      if (!domainId) return null;
      await until(domainId).toBeTruthy();
      return call<RspamdStats>(`${basePath.value}/stats`).catch(() => null);
    },
    { server: false, immediate: !!domainId, watch: domainId ? [domainId, tick] : [], default: () => null }
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

  const stats = computed(() => realtimeStats.value ?? (domainId ? statsData.value : null));
  const statsUnavailable = computed(() =>
    domainId ? statsStatus.value === "success" && !statsData.value && !realtimeStats.value : false
  );
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

  const statsLoading = computed(() =>
    domainId ? statsStatus.value === "pending" && !realtimeStats.value : stats.value === null
  );
  const historyLoading = computed(() => historyStatus.value === "pending");
  const loading = computed(() => statsLoading.value || historyLoading.value);

  async function load() {
    await Promise.all([domainId ? refreshStats() : Promise.resolve(), refreshHistory()]);
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
