const HOST = /^https?:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?::\d{1,5})?$/i;

export function useGeneralConfig() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const form = reactive({ managerUrl: "" });
  const tlds = ref<Set<string>>(new Set());

  const managerUrlError = computed(() => {
    const v = form.managerUrl.trim();
    if (v === "") return undefined;
    const match = HOST.exec(v);
    if (!match) return t("config.general.managerUrlInvalid");
    const host = (match[1] ?? "").toLowerCase();
    const tld = host.slice(host.lastIndexOf(".") + 1);
    return tlds.value.has(tld) ? undefined : t("config.general.managerUrlInvalid");
  });
  const valid = computed(() => !managerUrlError.value);

  async function load() {
    try {
      const [general, catalogue] = await Promise.all([
        call<GeneralView>("/config/general"),
        call<{ tlds: string[] }>("/config/general/tlds"),
      ]);
      form.managerUrl = general.managerUrl ?? "";
      tlds.value = new Set(catalogue.tlds);
    } catch {
      toast.add({ title: t("config.general.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    if (!valid.value) return;
    saving.value = true;
    try {
      await call("/config/general", { method: "PUT", body: { managerUrl: form.managerUrl.trim() } });
      toast.add({ title: t("config.general.saved"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.general.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return { saving, loaded, form, managerUrlError, valid, load, save };
}
