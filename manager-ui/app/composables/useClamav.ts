interface ClamavAction {
  updated?: boolean;
  output?: string[];
  status: ClamavStatus;
}

// What the virus scanner is running and what it was given to run it with. One
// request, three sources behind it (clamd, the signature files, ClamAV's own
// published versions), and nothing here to poll: a signature database changes a
// few times a day, so the page is read on mount and on the shared refresh tick.
//
// Both actions answer with the state taken after they ran, so the page never
// has to ask again to show what changed.
export function useClamav() {
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();
  const { t } = useI18n();

  const status = shallowRef<ClamavStatus | null>(null);
  const loading = ref(false);
  const failed = ref(false);
  const busy = ref<"update" | "reload" | null>(null);

  async function load() {
    loading.value = !status.value;
    try {
      status.value = await call<ClamavStatus>("/clamav/status");
      failed.value = false;
    } catch {
      failed.value = true;
    } finally {
      loading.value = false;
    }
  }

  // The update waits for freshclam, which is minutes on a full download rather
  // than the seconds every other call here takes.
  async function run(action: "update" | "reload") {
    busy.value = action;
    try {
      const result = await call<ClamavAction>(`/clamav/${action}`, { method: "POST" });
      status.value = result.status;
      const title =
        action === "reload" ? "clamav.actions.reloaded" : result.updated ? "clamav.actions.updated" : "clamav.actions.current";
      toast.add({ title: t(title), color: "success" });
      return true;
    } catch (e) {
      toast.add({ title: t(`clamav.actions.${action}Failed`), description: apiErrorMessage(e), color: "error" });
      return false;
    } finally {
      busy.value = null;
    }
  }

  watch(useDataRefresh().tick, () => void load());
  onMounted(() => void load());

  return {
    status,
    loading,
    failed,
    busy,
    load,
    update: () => run("update"),
    reload: () => run("reload"),
  };
}
