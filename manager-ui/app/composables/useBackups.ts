const RETRIEVAL_POLL_MS = 3000;
const RETRIEVAL_POLL_ROUNDS = 400;

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

  async function load() {
    try {
      const [state, list] = await Promise.all([call<BackupOverview>("/backups"), call<BackupFile[]>("/backups/files")]);
      overview.value = state;
      files.value = list;
      failed.value = false;
      const pending = state.retrieval?.pending;
      if (pending && timer === null) {
        retrieving.value = pending.name;
        waitForRetrieval(pending.name, pending.id, false);
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

  function waitForRetrieval(name: string, id: string, thenDownload: boolean, round = 0) {
    stopWaiting();
    timer = setTimeout(async () => {
      await load();
      const retrieval = overview.value?.retrieval;
      if (retrieval?.pending?.id === id && round < RETRIEVAL_POLL_ROUNDS) {
        waitForRetrieval(name, id, thenDownload, round + 1);
        return;
      }
      timer = null;
      retrieving.value = null;
      if (files.value.find((file) => file.name === name)?.downloadable) {
        if (thenDownload) await download(name);
        return;
      }
      toast.add({
        title: t("backups.files.retrieveFailed"),
        description: retrieval?.last?.id === id ? retrieval.last.error : undefined,
        color: "error",
      });
    }, RETRIEVAL_POLL_MS);
  }

  async function retrieve(name: string) {
    retrieving.value = name;
    try {
      const state = await call<BackupRetrieval>(`/backups/files/${encodeURIComponent(name)}/retrieve`, { method: "POST" });
      toast.add({ title: t("backups.files.retrievingTitle"), description: t("backups.files.retrievingHint"), color: "info" });
      waitForRetrieval(name, state.pending?.id ?? "", true);
    } catch (err) {
      retrieving.value = null;
      toast.add({ title: t("backups.files.retrieveFailed"), description: apiErrorMessage(err), color: "error" });
    }
  }

  onBeforeUnmount(stopWaiting);

  return { overview, files, loaded, failed, downloading, retrieving, load, download, retrieve };
}
