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
  const loading = ref(false);
  const statsUnavailable = ref(false);

  const { call } = useApi();
  const { set: setBreadcrumb } = useBreadcrumb();
  const { t } = useI18n();

  setBreadcrumb([{ label: t("nav.rspamd") }]);

  async function load() {
    loading.value = true;
    try {
      const [s, h] = await Promise.allSettled([
        call<RspamdStats>("/rspamd/stats"),
        call<RspamdHistoryRow[]>("/rspamd/history?size=200"),
      ]);
      stats.value = s.status === "fulfilled" ? s.value : null;
      statsUnavailable.value = s.status === "rejected";
      history.value = h.status === "fulfilled" ? h.value : [];
    } finally {
      loading.value = false;
    }
  }

  watch(useDataRefresh().tick, load);
  onMounted(load);

  return { stats, history, loading, statsUnavailable, load };
}
