interface RetentionView {
  supervisionRetentionMs: number;
}

const DAY_MS = 86_400_000;
/** One row per ten seconds, which is what a day of history costs in rows. */
const ROWS_PER_DAY = 8_640;

export const RETENTION_MIN_DAYS = 1;
export const RETENTION_MAX_DAYS = 365;
export const RETENTION_DEFAULT_DAYS = 30;

// Kept in days rather than milliseconds: nobody sets a retention in
// milliseconds, and the API is the only place that has to speak in them.
export function useSupervisionRetention() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const days = ref(RETENTION_DEFAULT_DAYS);

  const valid = computed(
    () => Number.isInteger(days.value) && days.value >= RETENTION_MIN_DAYS && days.value <= RETENTION_MAX_DAYS
  );

  // What the choice costs, said in rows rather than left to be discovered on a
  // disk: a year is twelve times the month the default keeps.
  const rows = computed(() => (valid.value ? days.value * ROWS_PER_DAY : 0));

  function resetDefaults() {
    days.value = RETENTION_DEFAULT_DAYS;
  }

  async function load() {
    try {
      const data = await call<RetentionView>("/config/supervision");
      days.value = Math.round(data.supervisionRetentionMs / DAY_MS);
    } catch {
      toast.add({ title: t("config.supervision.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    if (!valid.value) return;
    saving.value = true;
    try {
      await call("/config/supervision", { method: "PUT", body: { supervisionRetentionMs: days.value * DAY_MS } });
      toast.add({ title: t("config.supervision.saved"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.supervision.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return { saving, loaded, days, valid, rows, load, save, resetDefaults };
}
