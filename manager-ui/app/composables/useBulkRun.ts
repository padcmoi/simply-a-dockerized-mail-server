export function useBulkRun() {
  const { t } = useI18n();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const running = ref(false);

  async function run<K>(keys: K[], request: (key: K) => Promise<unknown>, doneTitle: (count: number) => string) {
    running.value = true;
    const done: K[] = [];
    let lastError: unknown = null;
    for (const key of keys) {
      try {
        await request(key);
        done.push(key);
      } catch (err) {
        lastError = err;
      }
    }
    running.value = false;
    if (done.length) toast.add({ title: doneTitle(done.length), color: "success", icon: "i-lucide-check" });
    if (lastError) {
      toast.add({
        title: t("table.bulkFailed", { count: keys.length - done.length }),
        description: apiErrorMessage(lastError),
        color: "error",
      });
    }
    return done;
  }

  return { running, run };
}
