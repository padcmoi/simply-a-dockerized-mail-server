export interface PassportProviderRow {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  clientId: string;
  /** What the provider's own console must be given, computed by the server. */
  javascriptOrigin: string;
  redirectUri: string;
}

interface PassportConfigResponse {
  passportEnabled: boolean;
  passportAutoProvision: boolean;
  managerUrlSet: boolean;
  providers: PassportProviderRow[];
}

// The server-wide external sign-in settings and every provider's credentials.
// Root only, like every /config route. The login screen never reads this: what
// it asks for is GET /auth/passport/providers, which only names the buttons.
//
// The two switches save on their own, debounced. Credentials are their own call
// per provider, since pasting a client id and a secret is a deliberate act that
// should not fire on every keystroke.
export function usePassportConfig() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const enabled = ref(false);
  const autoProvision = ref(false);
  const providers = ref<PassportProviderRow[]>([]);
  // False means nothing can work at all, whatever the switches say: the callback
  // handed to a provider is built from the manager URL.
  const managerUrlSet = ref(true);
  // What the server last told us the switches are. The watcher below compares
  // against it rather than against a "form is ready" flag: such a flag, set
  // right after apply(), is already true by the time the watcher runs a tick
  // later, so merely opening the page saved it straight back.
  let stored = { enabled: false, autoProvision: false };

  function apply(data: PassportConfigResponse) {
    enabled.value = data.passportEnabled;
    autoProvision.value = data.passportAutoProvision;
    managerUrlSet.value = data.managerUrlSet;
    providers.value = data.providers;
    stored = { enabled: data.passportEnabled, autoProvision: data.passportAutoProvision };
  }

  async function load() {
    try {
      apply(await call<PassportConfigResponse>("/config/passport"));
    } catch {
      toast.add({ title: t("config.passport.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  // The response is deliberately not applied back: it echoes what was just
  // sent, and writing it into the refs would retrigger the watcher below.
  async function saveSwitches() {
    saving.value = true;
    try {
      await call("/config/passport", {
        method: "PUT",
        body: { passportEnabled: enabled.value, passportAutoProvision: autoProvision.value },
      });
      stored = { enabled: enabled.value, autoProvision: autoProvision.value };
      toast.add({ title: t("config.passport.saved"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.passport.saveFailed"), description: apiErrorMessage(err), color: "error" });
      // The server refused, so the page must stop showing the refused state as
      // if it were stored: read back what actually holds.
      await load();
    } finally {
      saving.value = false;
    }
  }

  // Credentials, and the provider's own on/off flag, which lives with them.
  async function saveProvider(id: string, input: { clientId: string; clientSecret?: string; enabled: boolean }) {
    saving.value = true;
    try {
      apply(await call<PassportConfigResponse>(`/config/passport/providers/${id}`, { method: "PUT", body: input }));
      toast.add({ title: t("config.passport.providerSaved"), color: "success", icon: "i-lucide-check" });
      return true;
    } catch (err) {
      toast.add({ title: t("config.passport.saveFailed"), description: apiErrorMessage(err), color: "error" });
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function forgetProvider(id: string) {
    saving.value = true;
    try {
      apply(await call<PassportConfigResponse>(`/config/passport/providers/${id}`, { method: "DELETE" }));
      toast.add({ title: t("config.passport.providerForgotten"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.passport.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  const autosave = useAutosave(saveSwitches);

  // Only a real change writes: opening the page, or reloading it after a refused
  // save, puts back what the server already holds and must stay silent.
  watch([enabled, autoProvision], () => {
    if (enabled.value === stored.enabled && autoProvision.value === stored.autoProvision) return;
    void autosave();
  });

  return {
    saving,
    loaded,
    enabled,
    autoProvision,
    providers,
    managerUrlSet,
    load,
    saveProvider,
    forgetProvider,
  };
}
