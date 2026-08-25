export interface MyDelegation {
  domainId: number;
  domain: string;
  maxRecipients: number | null;
  maxAliases: number | null;
  quotaMb: number;
  usedRecipients: number;
  usedAliases: number;
  usedBytes: string;
}

// The personal space's delegation card and its dedicated creation pages all
// read the same snapshot of the delegations the caller holds.
export function useMyDelegations() {
  const { call } = useApi();
  const { tick } = useDataRefresh();

  const { data, status, refresh } = useAsyncData<MyDelegation[]>(
    "myspace-delegations",
    () => call<MyDelegation[]>("/my-space/delegations"),
    { server: false, watch: [tick], default: () => [] }
  );

  const hasLoadedOnce = ref(false);

  const rows = computed(() => data.value ?? []);
  const loading = computed(() => status.value === "pending");

  watch(
    status,
    (s) => {
      if (s === "success" || s === "error") hasLoadedOnce.value = true;
    },
    { immediate: true }
  );

  return { rows, loading, hasLoadedOnce, refresh };
}
