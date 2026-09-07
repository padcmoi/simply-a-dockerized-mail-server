// The operators behind an unusual sign-in, for the account itself or, with an
// id, for whoever may edit it. Same shape on both sides, so one card serves
// /profile and the account sheet alike.
export function useKnownNetworks(accountId?: MaybeRefOrGetter<string | undefined>) {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const networks = ref<KnownNetwork[]>([]);
  const loaded = ref(false);
  const busy = ref("");

  const base = computed(() => {
    const id = toValue(accountId);
    return id ? `/accounts/${id}/networks` : "/auth/jwt/me/networks";
  });

  const keyOf = (network: KnownNetwork) => `${network.countryCode}-${network.asn}`;

  async function load() {
    try {
      networks.value = await call<KnownNetwork[]>(base.value);
    } catch (err) {
      toast.add({ title: t("known.loadFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      loaded.value = true;
    }
    return true;
  }

  async function forget(network: KnownNetwork) {
    busy.value = keyOf(network);
    try {
      await call(`${base.value}/${network.countryCode}/${network.asn}`, { method: "DELETE" });
      toast.add({ title: t("known.networkForgotten"), color: "success", icon: "i-lucide-check" });
      await load();
    } catch (err) {
      toast.add({ title: t("known.forgetFailed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      busy.value = "";
    }
  }

  return { networks, loaded, busy, keyOf, load, forget };
}
