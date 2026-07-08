export interface RspamdActionThresholds {
  reject: number | null;
  softReject: number | null;
  rewriteSubject: number | null;
  addHeader: number | null;
  greylist: number | null;
}

export interface SaveRspamdActionsInput {
  reject: number | null;
  rewriteSubject: number | null;
  addHeader: number | null;
  greylist: number | null;
}

// Server-wide config, not domain-scoped -- only ever used from the global
// /rspamd admin page, gated by the "rspamd" resource's modify+delete
// actions (stricter than every other rspamd endpoint, see the API side).
export function useRspamdActions() {
  const { call } = useApi();
  const { tick } = useDataRefresh();

  const {
    data,
    status,
    refresh: refreshActions,
  } = useAsyncData<RspamdActionThresholds | null>(
    "rspamd-actions",
    () => call<RspamdActionThresholds>("/rspamd/actions").catch(() => null),
    { server: false, watch: [tick], default: () => null }
  );

  const actions = computed(() => data.value);
  const actionsLoading = computed(() => status.value === "pending");

  async function saveActions(input: SaveRspamdActionsInput) {
    await call("/rspamd/actions", { method: "PATCH", body: input });
    await refreshActions();
  }

  // The factory values themselves live only on the API side
  // (RSPAMD_FACTORY_ACTIONS, mirroring images/rspamd/conf/override.d/actions.conf)
  // -- this never duplicates them here, just triggers the reset.
  async function resetActions() {
    await call("/rspamd/actions", { method: "DELETE" });
    await refreshActions();
  }

  return { actions, actionsLoading, refreshActions, saveActions, resetActions };
}
