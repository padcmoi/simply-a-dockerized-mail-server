import { useDebounceFn, useLocalStorage } from "@vueuse/core";

const PAGE = 500;
const SEARCH_STORAGE_KEY = "manager-mail-logs-search";

export function useMailLog(service: MailLogService) {
  const { call } = useApi();

  const search = useLocalStorage(`${SEARCH_STORAGE_KEY}-${service}`, "", { initOnMounted: true });
  const window = shallowRef<MailLogWindow | null>(null);
  const loading = ref(false);
  const loadingOlder = ref(false);
  const failed = ref(false);
  const downloading = ref(false);
  const downloadFailed = ref(false);

  let asked = 0;
  let disposed = false;
  let loadedTerm: string | null = null;

  function query(before?: number) {
    const params = new URLSearchParams({ lines: String(PAGE) });
    const term = search.value.trim();
    if (term) params.set("q", term);
    if (before !== undefined) params.set("before", String(before));
    return `/mail-logs/${service}?${params.toString()}`;
  }

  async function load() {
    if (disposed) return;
    const ticket = ++asked;
    loadedTerm = search.value.trim();
    loading.value = true;
    loadingOlder.value = false;
    try {
      const answer = await call<MailLogWindow>(query());
      if (ticket !== asked) return;
      window.value = answer;
      failed.value = false;
    } catch {
      if (ticket === asked) failed.value = true;
    } finally {
      if (ticket === asked) loading.value = false;
    }
  }

  async function loadOlder() {
    const current = window.value;
    if (disposed || !current || current.start === 0 || loading.value || loadingOlder.value) return;
    const ticket = asked;
    loadingOlder.value = true;
    try {
      const answer = await call<MailLogWindow>(query(current.start));
      if (ticket !== asked || !window.value) return;
      window.value = {
        ...window.value,
        lines: [...answer.lines, ...window.value.lines],
        start: answer.start,
        truncated: answer.truncated,
      };
    } catch {
      if (ticket === asked) failed.value = true;
    } finally {
      if (ticket === asked) loadingOlder.value = false;
    }
  }

  async function download() {
    downloading.value = true;
    downloadFailed.value = false;
    try {
      const file = await call<Blob>(`/mail-logs/${service}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${service}.log`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      downloadFailed.value = true;
    } finally {
      downloading.value = false;
    }
  }

  const loadSoon = useDebounceFn(load, 300);

  const frame = useRealtimeTopic<MailLogFrame>(`mail-log:${service}`);

  watch(search, (term) => {
    if (term.trim() !== loadedTerm) void loadSoon();
  });
  watch(useDataRefresh().tick, () => void load());

  watch(frame, (next) => {
    const current = window.value;
    if (!next || !current || loading.value || next.service !== current.service || next.to <= current.size) return;
    if (next.from !== current.size) {
      void load();
      return;
    }

    const needle = search.value.trim().toLowerCase();
    const fresh = needle ? next.lines.filter((line) => line.toLowerCase().includes(needle)) : next.lines;
    window.value = {
      ...current,
      lines: [...current.lines, ...fresh],
      size: next.to,
      updatedAt: new Date().toISOString(),
    };
  });

  onMounted(() => void load());

  onScopeDispose(() => {
    disposed = true;
    asked++;
    window.value = null;
  });

  return { search, window, loadingOlder, failed, downloading, downloadFailed, download, loadOlder };
}
