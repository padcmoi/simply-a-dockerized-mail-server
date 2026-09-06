export const LOGIN_RADIUS_MIN_KM = 0;
/** Half the Earth's circumference: past it no two points on the globe are far. */
export const LOGIN_RADIUS_MAX_KM = 20037;
/** A hundred kilometres, the server's own default: a commute, a holiday down
 *  the coast or a provider moving a subscriber between two of its ranges stays
 *  under it, another country never does. */
export const LOGIN_RADIUS_DEFAULT_KM = 100;

export function useLoginRiskConfig() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const radiusKm = ref(LOGIN_RADIUS_DEFAULT_KM);
  const order = ref<LoginChallengeOrder>("question,email");

  // The authenticator app is not one of the choices: an account that carries
  // one is asked for its code and nothing else, whatever is set here.
  const orderItems = computed(() => [
    { value: "question,email", label: t("config.loginRisk.orderQuestionFirst") },
    { value: "email,question", label: t("config.loginRisk.orderMailFirst") },
  ]);

  const valid = computed(() => {
    const v = Number(radiusKm.value);
    return Number.isInteger(v) && v >= LOGIN_RADIUS_MIN_KM && v <= LOGIN_RADIUS_MAX_KM;
  });

  const radiusError = computed(() => (valid.value ? undefined : t("config.loginRisk.radiusInvalid")));
  // Zero is a setting, not a mistake, and it is the one worth saying out loud:
  // nothing is ever asked again, however far a sign-in comes from.
  const disabled = computed(() => valid.value && Number(radiusKm.value) === 0);

  function resetDefaults() {
    radiusKm.value = LOGIN_RADIUS_DEFAULT_KM;
    order.value = "question,email";
  }

  async function load() {
    try {
      const data = await call<LoginRiskView>("/config/login-risk");
      radiusKm.value = data.loginRadiusKm ?? LOGIN_RADIUS_DEFAULT_KM;
      order.value = data.loginChallengeOrder ?? "question,email";
    } catch {
      toast.add({ title: t("config.loginRisk.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    if (!valid.value) return;
    saving.value = true;
    try {
      await call("/config/login-risk", {
        method: "PUT",
        body: { loginRadiusKm: Number(radiusKm.value), loginChallengeOrder: order.value },
      });
      toast.add({ title: t("config.loginRisk.saved"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.loginRisk.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return { saving, loaded, radiusKm, order, orderItems, valid, radiusError, disabled, load, save, resetDefaults };
}
