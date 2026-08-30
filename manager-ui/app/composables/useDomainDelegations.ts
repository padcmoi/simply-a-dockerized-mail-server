// The delegation pages of a domain all read the same snapshot: the active
// grants, the pending invitations and open links, and the flags the tables need.
export function useDomainDelegations() {
  const { call } = useApi();
  const { domainId, domainFqdn } = useCurrentDomain();
  const { tick } = useDataRefresh();

  const { data, status, refresh } = useAsyncData<DelegationsPayload | null>(
    "domain-delegations",
    async () => {
      if (!domainId.value) return null;
      return call<DelegationsPayload>(`/domains/${domainId.value}/delegations`);
    },
    { server: false, watch: [domainId, tick], default: () => null }
  );

  const hasLoadedOnce = ref(false);

  const rows = computed(() => data.value?.delegations ?? []);
  const pending = computed(() => data.value?.pendingInvitations ?? []);
  const grantableMb = computed(() => data.value?.grantableMb ?? null);
  const loading = computed(() => status.value === "pending");

  watch(
    status,
    (s) => {
      if (s === "success" || s === "error") hasLoadedOnce.value = true;
    },
    { immediate: true }
  );

  return { domainId, domainFqdn, rows, pending, grantableMb, loading, hasLoadedOnce, refresh };
}
