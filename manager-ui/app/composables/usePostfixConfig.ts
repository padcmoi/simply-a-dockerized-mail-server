const DEFAULTS: PostfixSettings = {
  bounceSenderLocal: "mailer-daemon",
  bounceSenderDomain: "",
  delayWarningHours: 0,
  maximalQueueLifetimeDays: 3,
};

const LOCAL_PART = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
const POLL_MS = 2000;
const POLL_ROUNDS = 15;

export function usePostfixConfig() {
  const { t, locale } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const form = reactive<PostfixSettings>({ ...DEFAULTS });
  const hostname = ref("");
  const domains = ref<string[]>([]);
  const status = ref<PostfixApplyStatus | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const localPartError = computed(() =>
    form.bounceSenderLocal.length > 64 || !LOCAL_PART.test(form.bounceSenderLocal) || form.bounceSenderLocal.includes("..")
      ? t("config.postfix.localPartInvalid")
      : undefined
  );
  const delayWarningError = computed(() =>
    !Number.isInteger(form.delayWarningHours) || form.delayWarningHours < 0 || form.delayWarningHours > 24
      ? t("config.postfix.delayWarningRange")
      : form.delayWarningHours >= form.maximalQueueLifetimeDays * 24
        ? t("config.postfix.delayWarningAfterLifetime")
        : undefined
  );
  const lifetimeError = computed(() =>
    !Number.isInteger(form.maximalQueueLifetimeDays) || form.maximalQueueLifetimeDays < 1 || form.maximalQueueLifetimeDays > 5
      ? t("config.postfix.lifetimeRange")
      : undefined
  );
  const valid = computed(() => !localPartError.value && !delayWarningError.value && !lifetimeError.value);

  const sender = computed(() =>
    form.bounceSenderDomain ? `${form.bounceSenderLocal}@${form.bounceSenderDomain}` : `mailer-daemon@${hostname.value}`
  );
  const senderDisplay = computed(() => `Mail Delivery System <${sender.value}>`);

  const appliedAt = computed(() =>
    status.value?.appliedAt ? new Date(status.value.appliedAt).toLocaleString(locale.value.replace("_", "-")) : ""
  );

  function stopPolling() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function poll(round = 0) {
    stopPolling();
    if (status.value?.state !== "pending" || round >= POLL_ROUNDS) return;
    timer = setTimeout(async () => {
      try {
        const data = await call<PostfixSettingsView>("/config/postfix");
        status.value = data.status;
      } catch {
        return;
      }
      poll(round + 1);
    }, POLL_MS);
  }

  function fill(data: PostfixSettingsView) {
    Object.assign(form, data.settings);
    hostname.value = data.hostname;
    domains.value = data.domains;
    status.value = data.status;
  }

  function resetDefaults() {
    Object.assign(form, DEFAULTS);
  }

  async function load() {
    try {
      fill(await call<PostfixSettingsView>("/config/postfix"));
      poll();
    } catch {
      toast.add({ title: t("config.postfix.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    if (!valid.value) return;
    saving.value = true;
    try {
      fill(await call<PostfixSettingsView>("/config/postfix", { method: "PUT", body: { ...form } }));
      toast.add({ title: t("config.postfix.saved"), color: "success", icon: "i-lucide-check" });
      poll();
    } catch (err) {
      toast.add({ title: t("config.postfix.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  onScopeDispose(stopPolling);

  return {
    saving,
    loaded,
    form,
    hostname,
    domains,
    status,
    appliedAt,
    localPartError,
    delayWarningError,
    lifetimeError,
    valid,
    senderDisplay,
    load,
    save,
    resetDefaults,
  };
}
