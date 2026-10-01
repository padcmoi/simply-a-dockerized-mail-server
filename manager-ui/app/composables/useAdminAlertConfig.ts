const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;.]{2,}$/;

export function useAdminAlertConfig() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const stored = ref("");
  const form = reactive({ adminAlertEmail: "" });

  const typed = computed(() => form.adminAlertEmail.trim().toLowerCase());
  const emailError = computed(() => {
    if (typed.value === "") return undefined;
    return EMAIL.test(typed.value) && typed.value.length <= 254 ? undefined : t("config.adminAlert.emailInvalid");
  });
  const dirty = computed(() => typed.value !== stored.value);
  const valid = computed(() => !emailError.value && dirty.value);

  async function load() {
    try {
      const view = await call<AdminAlertView>("/config/alert");
      stored.value = view.adminAlertEmail ?? "";
      form.adminAlertEmail = stored.value;
    } catch {
      toast.add({ title: t("config.adminAlert.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    if (!valid.value) return;
    saving.value = true;
    try {
      const view = await call<AdminAlertView>("/config/alert", {
        method: "PUT",
        body: { adminAlertEmail: typed.value },
      });
      stored.value = view.adminAlertEmail ?? "";
      form.adminAlertEmail = stored.value;
      toast.add({
        title: t(stored.value ? "config.adminAlert.saved" : "config.adminAlert.cleared"),
        color: "success",
        icon: "i-lucide-check",
      });
    } catch (err) {
      toast.add({ title: t("config.adminAlert.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return { saving, loaded, form, emailError, valid, load, save };
}
