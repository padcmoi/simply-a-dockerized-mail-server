// What the virus scanner is running and what it was given to run it with. One
// request, three sources behind it (clamd, the signature files, ClamAV's own
// published versions), and nothing here to poll: a signature database changes a
// few times a day, so the page is read on mount and on the shared refresh tick.
export function useClamav() {
  const { call } = useApi();

  const status = ref<ClamavStatus | null>(null);
  const loading = ref(false);
  const failed = ref(false);

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

  watch(useDataRefresh().tick, () => void load());
  onMounted(() => void load());

  return { status, loading, failed, load };
}
