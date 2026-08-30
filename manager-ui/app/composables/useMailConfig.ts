import { useAuthStore } from "~/stores/auth";

export function useMailConfig() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();
  const auth = useAuthStore();

  const saving = ref(false);
  const testing = ref(false);
  const verifying = ref(false);
  const activating = ref(false);
  const otp = ref<number[]>([]);
  const otpError = ref(false);
  const sendError = ref<string | null>(null);
  const otpSent = ref(false);
  const resendIn = ref(0);
  const active = ref<string | number>("config");
  const configs = ref<ConfigView[]>([]);
  const selected = ref<string | null>(null);
  const hasPassword = ref(false);
  const editing = ref(false);
  const form = reactive({
    provider: "brevo" as MailProvider,
    host: "",
    port: null as number | null,
    secure: false,
    username: "",
    password: "",
    fromAddress: "",
  });
  let resendTimer: ReturnType<typeof setInterval> | null = null;

  const userEmail = computed(() => auth.session?.email ?? "");
  const providerOptions = computed(() => [
    { value: "brevo", label: t("config.mail.providerBrevo") },
    { value: "smtp", label: t("config.mail.providerSmtp") },
    { value: "off", label: t("config.mail.providerOff") },
  ]);
  const isOff = computed(() => form.provider === "off");
  const isBrevo = computed(() => form.provider === "brevo");
  const isSelected = computed(() => selected.value === form.provider);
  const providerHint = computed(() => t(`config.mail.providerHint.${form.provider}`));
  const showServer = computed(() => form.provider === "smtp");
  const activeLabel = computed(() => providerLabel(selected.value));
  const savedForCurrent = computed(() => configs.value.some((c) => c.provider === form.provider));
  const validatedForCurrent = computed(() => configs.value.find((c) => c.provider === form.provider)?.validated === true);
  const stepIcon = computed(() => (validatedForCurrent.value ? "i-lucide-circle-check" : "i-lucide-circle-x"));
  const stepperColor = computed<"success" | "error">(() => (validatedForCurrent.value ? "success" : "error"));
  const steps = computed(() => [
    { value: "config", title: t("config.mail.stepConfig"), icon: stepIcon.value, disabled: false },
    { value: "verify", title: t("config.mail.stepVerify"), icon: stepIcon.value, disabled: !savedForCurrent.value },
    { value: "done", title: t("config.mail.stepDone"), icon: stepIcon.value, disabled: !validatedForCurrent.value },
  ]);
  const usernameLabel = computed(() => t(isBrevo.value ? "config.mail.brevoUsername" : "config.mail.username"));
  const usernameHint = computed(() => t(isBrevo.value ? "config.mail.brevoUsernameHint" : "config.mail.smtpCredsHint"));
  const usernamePlaceholder = computed(() => (isBrevo.value ? "login@example.com" : ""));
  const passwordLabel = computed(() => t(isBrevo.value ? "config.mail.brevoPassword" : "config.mail.password"));
  const passwordHint = computed(() => {
    if (hasPassword.value) return t("config.mail.passwordKeepHint");
    return isBrevo.value ? t("config.mail.brevoPasswordHint") : undefined;
  });
  const passwordPlaceholder = computed(() => {
    if (hasPassword.value) return "••••••••";
    return isBrevo.value ? "xsmtpsib-..." : "";
  });
  const fromHint = computed(() => t(isBrevo.value ? "config.mail.brevoFromHint" : "config.mail.fromAddressHint"));
  const readOnly = computed(() => savedForCurrent.value && !editing.value);
  const summaryRows = computed(() => {
    const rows: { label: string; value: string }[] = [];
    if (showServer.value) {
      rows.push({ label: t("config.mail.host"), value: form.host || "-" });
      rows.push({ label: t("config.mail.port"), value: form.port ? String(form.port) : "-" });
    }
    rows.push({ label: usernameLabel.value, value: form.username || "-" });
    rows.push({
      label: passwordLabel.value,
      value: hasPassword.value ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "-",
    });
    rows.push({ label: t("config.mail.fromAddress"), value: form.fromAddress || "-" });
    return rows;
  });

  watch(
    () => form.provider,
    (p) => selectProvider(p)
  );

  function providerLabel(p: string | null) {
    if (p === "brevo") return t("config.mail.providerBrevo");
    if (p === "smtp") return t("config.mail.providerSmtp");
    return "";
  }

  function loadFields(provider: "brevo" | "smtp") {
    const c = configs.value.find((x) => x.provider === provider);
    form.host = c?.host ?? "";
    form.port = c?.port ?? null;
    form.secure = c?.secure ?? false;
    form.username = c?.username ?? "";
    form.fromAddress = c?.fromAddress ?? "";
    form.password = "";
    hasPassword.value = c?.hasPassword ?? false;
    editing.value = false;
    otp.value = [];
    otpError.value = false;
    sendError.value = null;
    otpSent.value = false;
  }

  function selectProvider(p: MailProvider) {
    if (p === "off") {
      if (selected.value !== null) disable();
      return;
    }
    loadFields(p);
    const c = configs.value.find((x) => x.provider === p);
    active.value = c?.validated ? "done" : "config";
  }

  function startCooldown() {
    resendIn.value = 60;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      resendIn.value -= 1;
      if (resendIn.value <= 0 && resendTimer) {
        clearInterval(resendTimer);
        resendTimer = null;
        resendIn.value = 0;
      }
    }, 1000);
  }

  async function refreshList() {
    const data = await call<ListView>("/config/mail");
    configs.value = data.configs;
    selected.value = data.selected;
    hasPassword.value = configs.value.find((c) => c.provider === form.provider)?.hasPassword ?? false;
  }

  async function load() {
    try {
      const data = await call<ListView>("/config/mail");
      configs.value = data.configs;
      selected.value = data.selected;
      const initial: "brevo" | "smtp" = data.selected === "smtp" ? "smtp" : "brevo";
      form.provider = initial;
      selectProvider(initial);
    } catch {
      toast.add({ title: t("config.mail.loadFailed"), color: "error" });
    }
    return true;
  }

  async function saveStep() {
    saving.value = true;
    try {
      const body: Record<string, unknown> = {
        provider: form.provider,
        host: form.host || null,
        port: form.port,
        secure: form.secure,
        username: form.username || null,
        fromAddress: form.fromAddress || null,
      };
      if (form.password) body.password = form.password;
      await call("/config/mail", { method: "PUT", body });
      form.password = "";
      await refreshList();
      editing.value = false;
      await sendTest();
    } catch (err) {
      toast.add({ title: t("config.mail.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  async function sendTest() {
    testing.value = true;
    try {
      await call("/config/mail/test", { method: "POST", body: { provider: form.provider } });
      otpSent.value = true;
      sendError.value = null;
      startCooldown();
      active.value = "verify";
      toast.add({ title: t("config.mail.testSent", { email: userEmail.value }), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      otpSent.value = false;
      sendError.value = apiErrorMessage(err);
      active.value = "config";
      editing.value = true;
      toast.add({ title: t("config.mail.testFailed"), description: sendError.value, color: "error" });
    } finally {
      testing.value = false;
    }
  }

  async function verifyStep() {
    verifying.value = true;
    otpError.value = false;
    try {
      await call("/config/mail/verify", { method: "POST", body: { provider: form.provider, otp: otp.value.join("") } });
      otp.value = [];
      otpSent.value = false;
      await refreshList();
      await auth.fetchProfile().catch(() => undefined);
      active.value = "done";
      toast.add({
        title: t("config.mail.activated", { provider: providerLabel(form.provider) }),
        color: "success",
        icon: "i-lucide-check",
      });
    } catch (err) {
      otp.value = [];
      otpError.value = true;
      toast.add({ title: t("config.mail.otpFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      verifying.value = false;
    }
  }

  async function activate() {
    activating.value = true;
    try {
      await call("/config/mail/select", { method: "POST", body: { provider: form.provider } });
      await refreshList();
      await auth.fetchProfile().catch(() => undefined);
      toast.add({
        title: t("config.mail.activated", { provider: providerLabel(form.provider) }),
        color: "success",
        icon: "i-lucide-check",
      });
    } catch (err) {
      toast.add({ title: t("config.mail.otpFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      activating.value = false;
    }
  }

  function backToConfig() {
    active.value = "config";
  }

  function edit() {
    editing.value = true;
    active.value = "config";
  }

  function cancelEdit() {
    if (form.provider === "brevo" || form.provider === "smtp") loadFields(form.provider);
  }

  function onOtpInput(val: number[]) {
    otp.value = val;
    otpError.value = false;
    if (val.join("").length === 6 && !verifying.value) verifyStep();
  }

  async function disable() {
    try {
      await call("/config/mail/disable", { method: "POST" });
      await refreshList();
      await auth.fetchProfile().catch(() => undefined);
      toast.add({ title: t("config.mail.disabled"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.mail.disableFailed"), description: apiErrorMessage(err), color: "error" });
    }
  }

  onBeforeUnmount(() => {
    if (resendTimer) clearInterval(resendTimer);
  });

  return {
    userEmail,
    saving,
    testing,
    verifying,
    activating,
    otp,
    otpError,
    sendError,
    otpSent,
    resendIn,
    active,
    selected,
    form,
    providerOptions,
    isOff,
    isSelected,
    providerHint,
    showServer,
    activeLabel,
    steps,
    stepperColor,
    usernameLabel,
    usernameHint,
    usernamePlaceholder,
    passwordLabel,
    passwordHint,
    passwordPlaceholder,
    fromHint,
    readOnly,
    summaryRows,
    providerLabel,
    load,
    saveStep,
    sendTest,
    verifyStep,
    onOtpInput,
    editing,
    activate,
    edit,
    cancelEdit,
    backToConfig,
    disable,
    refreshList,
  };
}
