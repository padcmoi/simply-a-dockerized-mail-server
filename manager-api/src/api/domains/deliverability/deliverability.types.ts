// A check is data, never a sentence: the API answers an id, a verdict and the
// raw evidence it read, and manager-ui owns the wording in both languages
// (i18n `deliverability.checks.<id>`). Evidence stays technical and
// language-neutral - an address, an rcode, a record - so it can be printed as
// is next to the translated label.
export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export type CheckSection = "identity" | "dns" | "server" | "reputation";

export interface CheckResult {
  id: string;
  section: CheckSection;
  status: CheckStatus;
  // What was actually read. Empty when the check had nothing to show.
  evidence: string;
  // Values the UI interpolates into its own sentence, when the label needs it.
  params?: Record<string, string | number>;
}

export interface DeliverabilityReport {
  domain: string;
  checkedAt: string;
  // The address every conclusion is about: the MX's, which is what the outside
  // world sees. Null when the MX does not resolve, in which case most checks
  // below are skipped rather than failed.
  mailIp: string | null;
  mxHost: string | null;
  counts: Record<CheckStatus, number>;
  checks: CheckResult[];
}
