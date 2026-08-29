// A check is data, never a sentence: the API answers an id, a verdict and the
// raw evidence it read, and manager-ui owns the wording in both languages
// (i18n `deliverability.checks.<id>`). Evidence stays technical and
// language-neutral - an address, an rcode, a record - so it can be printed as
// is next to the translated label.
// Three verdicts, and no fourth. A check that cannot be judged is not a grey
// row for the reader to interpret: the probe emits no row at all, because a
// line that never concludes teaches nothing.
export type CheckStatus = "pass" | "warn" | "fail";

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
  // world sees. Null when the MX does not resolve, in which case the checks
  // that depend on it are not emitted rather than guessed at.
  mailIp: string | null;
  mxHost: string | null;
  // The address the probe spoke from. It has to be one postfix does not trust,
  // or every answer it got is the answer given to a trusted client.
  probedFrom: string;
  counts: Record<CheckStatus, number>;
  checks: CheckResult[];
}
