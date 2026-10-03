const RETRIEVAL_POLL_MS = 3000;
const RETRIEVAL_POLL_ROUNDS = 400;
const LISTING_POLL_MS = 5000;
const LISTING_POLL_ROUNDS = 24;

export function useBackups() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const overview = ref<BackupOverview | null>(null);
  const files = ref<BackupFile[]>([]);
  const loaded = ref(false);
  const failed = ref(false);
  const downloading = ref<string | null>(null);
  const retrieving = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let listingTimer: ReturnType<typeof setTimeout> | null = null;
  let listingRounds = 0;

  function watchListing(pending: boolean) {
    if (!pending) {
      listingRounds = 0;
      return;
    }
    if (listingTimer !== null || listingRounds >= LISTING_POLL_ROUNDS) return;
    listingRounds += 1;
    listingTimer = setTimeout(() => {
      listingTimer = null;
      void load();
    }, LISTING_POLL_MS);
  }

  async function load() {
    try {
      const [state, list] = await Promise.all([call<BackupOverview>("/backups"), call<BackupFile[]>("/backups/files")]);
      overview.value = state;
      files.value = list;
      failed.value = false;
      watchListing(list.some((file) => file.offsiteChecking));
      const pending = state.retrieval?.pending;
      if (pending && timer === null) {
        retrieving.value = pending.name;
        waitForRetrieval(pending.name, pending.id);
      }
    } catch {
      failed.value = true;
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function download(name: string) {
    downloading.value = name;
    try {
      const link = await call<{ token: string }>(`/backups/files/${encodeURIComponent(name)}/download-link`, { method: "POST" });
      window.location.assign(`/api/v1/backups/download/${link.token}`);
    } catch (err) {
      toast.add({ title: t("backups.files.downloadFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      downloading.value = null;
    }
  }

  function stopWaiting() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function waitForRetrieval(name: string, id: string, round = 0) {
    stopWaiting();
    timer = setTimeout(async () => {
      await load();
      const retrieval = overview.value?.retrieval;
      if (retrieval?.pending?.id === id && round < RETRIEVAL_POLL_ROUNDS) {
        waitForRetrieval(name, id, round + 1);
        return;
      }
      timer = null;
      retrieving.value = null;
      const last = retrieval?.last?.id === id ? retrieval.last : null;
      if (last?.state === "ready") {
        await download(name);
        return;
      }
      if (last?.state === "done") return;
      toast.add({ title: t("backups.files.retrieveFailed"), description: last?.error, color: "error" });
    }, RETRIEVAL_POLL_MS);
  }

  async function retrieve(name: string) {
    retrieving.value = name;
    try {
      const state = await call<BackupRetrieval>(`/backups/files/${encodeURIComponent(name)}/retrieve`, { method: "POST" });
      toast.add({ title: t("backups.files.retrievingTitle"), description: t("backups.files.retrievingHint"), color: "info" });
      waitForRetrieval(name, state.pending?.id ?? state.last?.id ?? "");
    } catch (err) {
      retrieving.value = null;
      toast.add({ title: t("backups.files.retrieveFailed"), description: apiErrorMessage(err), color: "error" });
    }
  }

  onBeforeUnmount(() => {
    stopWaiting();
    if (listingTimer) clearTimeout(listingTimer);
    listingTimer = null;
  });

  return { overview, files, loaded, failed, downloading, retrieving, load, download, retrieve };
}
