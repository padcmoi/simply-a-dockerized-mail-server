// The deliverability report, exactly as the API stores and answers it.

export type CheckStatus = "pass" | "warn" | "fail";
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
  // The address the probe spoke from, outside every docker network.
  probedFrom: string;
  counts: Record<CheckStatus, number>;
  checks: DeliverabilityCheck[];
}
