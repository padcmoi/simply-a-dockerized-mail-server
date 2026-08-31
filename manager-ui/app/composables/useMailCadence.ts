export function useMailCadence() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const DEFAULTS = { offlineNotifyAfterS: 300, offlineSweepIntervalS: 20, mailMinIntervalS: 30 };
  const saving = ref(false);
  const loaded = ref(false);
  const form = reactive({ ...DEFAULTS });

  const spoolError = computed(() =>
    form.mailMinIntervalS > form.offlineNotifyAfterS ? t("config.cadence.cannotExceedDelay") : undefined
  );
  const sweepError = computed(() =>
    form.offlineSweepIntervalS > form.offlineNotifyAfterS ? t("config.cadence.cannotExceedDelay") : undefined
  );
  const valid = computed(() => !spoolError.value && !sweepError.value);

  function resetDefaults() {
    Object.assign(form, DEFAULTS);
  }

  async function load() {
    try {
      const data = await call<CadenceView>("/config/mail-cadence");
      form.offlineNotifyAfterS = Math.round(data.offlineNotifyAfterMs / 1000);
      form.offlineSweepIntervalS = Math.round(data.offlineSweepIntervalMs / 1000);
      form.mailMinIntervalS = Math.round(data.mailMinIntervalMs / 1000);
    } catch {
      toast.add({ title: t("config.cadence.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    if (!valid.value) return;
    saving.value = true;
    try {
      await call("/config/mail-cadence", {
        method: "PUT",
        body: {
          offlineNotifyAfterMs: form.offlineNotifyAfterS * 1000,
          offlineSweepIntervalMs: form.offlineSweepIntervalS * 1000,
          mailMinIntervalMs: form.mailMinIntervalS * 1000,
        },
      });
      toast.add({ title: t("config.cadence.saved"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.cadence.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return { saving, loaded, form, spoolError, sweepError, valid, load, save, resetDefaults };
}
