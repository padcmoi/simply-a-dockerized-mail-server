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
  const stats = ref<RspamdStats | null>(null);
  const history = ref<RspamdHistoryRow[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const statsUnavailable = ref(false);
  const page = ref(1);
  const limit = useLocalStorage(LIST_LIMIT_STORAGE_KEY, 10);
  const search = ref("");
  const sortDir = ref<"asc" | "desc">("desc");

  const { call } = useApi();
  const { set: setBreadcrumb } = useBreadcrumb();
  const { t } = useI18n();

  setBreadcrumb([{ label: t("nav.rspamd") }]);

  // `size=200` bounds how many rows Rspamd's own ring buffer gives us before
  // our search/pagination/sortDir apply in-memory server-side (see
  // rspamd.service.ts) -- there's no deeper archive to page into.
  async function load() {
    loading.value = true;
    try {
      const qs = new URLSearchParams({
        size: "200",
        limit: String(limit.value),
        offset: String((page.value - 1) * limit.value),
        sortDir: sortDir.value,
      });
      if (search.value) qs.set("search", search.value);
      const [s, h] = await Promise.allSettled([
        call<RspamdStats>("/rspamd/stats"),
        call<{ items: RspamdHistoryRow[]; total: number }>(`/rspamd/history?${qs.toString()}`),
      ]);
      stats.value = s.status === "fulfilled" ? s.value : null;
      statsUnavailable.value = s.status === "rejected";
      history.value = h.status === "fulfilled" ? h.value.items : [];
      total.value = h.status === "fulfilled" ? h.value.total : 0;
    } finally {
      loading.value = false;
    }
  }

  const debouncedSearchReload = useDebounceFn(() => {
    page.value = 1;
    load();
  }, 300);
  watch(search, debouncedSearchReload);
  watch([page, limit, sortDir], load);
  watch(useDataRefresh().tick, load);
  onMounted(load);

  return { stats, history, total, loading, statsUnavailable, page, limit, search, sortDir, load };
}
