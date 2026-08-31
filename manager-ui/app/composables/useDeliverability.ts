// The sections in reading order: identity first, DNS next, the server itself,
// and reputation last - the same order docs/delivery/deliverability.md uses,
// because a red check high up makes everything below it meaningless.
export const DELIVERABILITY_SECTIONS: CheckSection[] = ["identity", "dns", "server", "reputation"];

export const STATUS_COLOR: Record<CheckStatus, "success" | "warning" | "error" | "neutral"> = {
  pass: "success",
  warn: "warning",
  fail: "error",
};

export const STATUS_ICON: Record<CheckStatus, string> = {
  pass: "i-lucide-check",
  warn: "i-lucide-triangle-alert",
  fail: "i-lucide-x",
};

export function useDeliverability(domainId: () => number | null) {
  const { call } = useApi();

  // Without `refresh` the API answers the report it has kept in redis, and
  // produces one only when there is none. With it, a new run replaces the
  // stored one: that is what the re-run button spends.
  function run(refresh = false) {
    const id = domainId();
    if (!id) return Promise.resolve(null);
    const query = refresh ? "?refresh=true" : "";
    return call<DeliverabilityReport>(`/domains/${id}/deliverability${query}`);
  }

  return { run };
}
