export const LOGIN_RADIUS_MIN_KM = 0;
/** Half the Earth's circumference: past it no two points on the globe are far. */
export const LOGIN_RADIUS_MAX_KM = 20037;
/** A hundred kilometres, the server's own default: a commute, a holiday down
 *  the coast or a provider moving a subscriber between two of its ranges stays
 *  under it, another country never does. */
export const LOGIN_RADIUS_DEFAULT_KM = 100;
export const GEOIP_CACHE_MIN_DAYS = 1;
export const GEOIP_CACHE_MAX_DAYS = 365;
/** Ninety days, the server's own default: an operator almost never changes
 *  hands, the city a provider names drifts over months, and a refresh four
 *  times a year costs nothing against a free quota. */
export const GEOIP_CACHE_DEFAULT_DAYS = 90;
export const LOGIN_ADDRESS_MIN_DAYS = 1;
export const LOGIN_ADDRESS_MAX_DAYS = 365;
export const LOGIN_ADDRESS_DEFAULT_DAYS = 30;
export const LOGIN_NETWORK_MIN_DAYS = 1;
export const LOGIN_NETWORK_MAX_DAYS = 365;
export const LOGIN_NETWORK_DEFAULT_DAYS = 180;

export function useLoginRiskConfig() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const saving = ref(false);
  const loaded = ref(false);
  const radiusKm = ref(LOGIN_RADIUS_DEFAULT_KM);
  const order = ref<LoginChallengeOrder>("question,email");
  const exclusive = ref(false);
  const cacheDays = ref(GEOIP_CACHE_DEFAULT_DAYS);
  const addressDays = ref(LOGIN_ADDRESS_DEFAULT_DAYS);
  const networkDays = ref(LOGIN_NETWORK_DEFAULT_DAYS);

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
  const cacheValid = computed(() => {
    const v = Number(cacheDays.value);
    return Number.isInteger(v) && v >= GEOIP_CACHE_MIN_DAYS && v <= GEOIP_CACHE_MAX_DAYS;
  });
  const cacheError = computed(() => (cacheValid.value ? undefined : t("config.loginRisk.cacheInvalid")));
  const addressValid = computed(() => {
    const v = Number(addressDays.value);
    return Number.isInteger(v) && v >= LOGIN_ADDRESS_MIN_DAYS && v <= LOGIN_ADDRESS_MAX_DAYS;
  });
  const addressError = computed(() => (addressValid.value ? undefined : t("config.loginRisk.addressInvalid")));
  const networkValid = computed(() => {
    const v = Number(networkDays.value);
    return Number.isInteger(v) && v >= LOGIN_NETWORK_MIN_DAYS && v <= LOGIN_NETWORK_MAX_DAYS;
  });
  const networkError = computed(() => (networkValid.value ? undefined : t("config.loginRisk.networkInvalid")));
  // Zero is a setting, not a mistake, and it is the one worth saying out loud:
  // nothing is ever asked again, however far a sign-in comes from.
  const disabled = computed(() => valid.value && Number(radiusKm.value) === 0);

  function resetDefaults() {
    radiusKm.value = LOGIN_RADIUS_DEFAULT_KM;
    order.value = "question,email";
    exclusive.value = false;
    cacheDays.value = GEOIP_CACHE_DEFAULT_DAYS;
    addressDays.value = LOGIN_ADDRESS_DEFAULT_DAYS;
    networkDays.value = LOGIN_NETWORK_DEFAULT_DAYS;
  }

  async function load() {
    try {
      const data = await call<LoginRiskView>("/config/login-risk");
      radiusKm.value = data.loginRadiusKm ?? LOGIN_RADIUS_DEFAULT_KM;
      order.value = data.loginChallengeOrder ?? "question,email";
      exclusive.value = data.loginChallengeExclusive ?? false;
      cacheDays.value = data.geoipCacheDays ?? GEOIP_CACHE_DEFAULT_DAYS;
      addressDays.value = data.loginAddressDays ?? LOGIN_ADDRESS_DEFAULT_DAYS;
      networkDays.value = data.loginNetworkDays ?? LOGIN_NETWORK_DEFAULT_DAYS;
    } catch {
      toast.add({ title: t("config.loginRisk.loadFailed"), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function save() {
    if (!valid.value || !cacheValid.value || !addressValid.value || !networkValid.value) return;
    saving.value = true;
    try {
      await call("/config/login-risk", {
        method: "PUT",
        body: {
          loginRadiusKm: Number(radiusKm.value),
          loginChallengeOrder: order.value,
          loginChallengeExclusive: exclusive.value,
          geoipCacheDays: Number(cacheDays.value),
          loginAddressDays: Number(addressDays.value),
          loginNetworkDays: Number(networkDays.value),
        },
      });
      toast.add({ title: t("config.loginRisk.saved"), color: "success", icon: "i-lucide-check" });
    } catch (err) {
      toast.add({ title: t("config.loginRisk.saveFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return {
    saving,
    loaded,
    radiusKm,
    order,
    orderItems,
    exclusive,
    cacheDays,
    addressDays,
    networkDays,
    valid,
    cacheValid,
    addressValid,
    networkValid,
    radiusError,
    cacheError,
    addressError,
    networkError,
    disabled,
    load,
    save,
    resetDefaults,
  };
}
