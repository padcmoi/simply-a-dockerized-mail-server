export type CheckStatus = "pass" | "warn" | "fail" | "skip";
export type CheckSection = "identity" | "dns" | "server" | "reputation";

export interface DeliverabilityCheck {
  id: string;
  section: CheckSection;
  status: CheckStatus;
  evidence: string;
  params?: Record<string, string | number>;
}

export interface DeliverabilityReport {
  domain: string;
  checkedAt: string;
  mxHost: string | null;
  mailIp: string | null;
  counts: Record<CheckStatus, number>;
  checks: DeliverabilityCheck[];
}

// The sections in reading order: identity first, DNS next, the server itself,
// and reputation last - the same order docs/delivery/deliverability.md uses,
// because a red check high up makes everything below it meaningless.
export const DELIVERABILITY_SECTIONS: CheckSection[] = ["identity", "dns", "server", "reputation"];

export const STATUS_COLOR: Record<CheckStatus, "success" | "warning" | "error" | "neutral"> = {
  pass: "success",
  warn: "warning",
  fail: "error",
  skip: "neutral",
};

export const STATUS_ICON: Record<CheckStatus, string> = {
  pass: "i-lucide-check",
  warn: "i-lucide-triangle-alert",
  fail: "i-lucide-x",
  skip: "i-lucide-minus",
};

export function useDeliverability(domainId: () => number | null) {
  const { call } = useApi();

  function run() {
    const id = domainId();
    if (!id) return Promise.resolve(null);
    return call<DeliverabilityReport>(`/domains/${id}/deliverability`);
  }

  return { run };
}
