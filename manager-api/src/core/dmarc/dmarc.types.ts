export type DmarcPolicy = "none" | "quarantine" | "reject";
export type DmarcAlignmentMode = "r" | "s";
export type DmarcVerdict = "pass" | "fail";

export interface DkimSignature {
  domain: string;
  selector: string;
  result: string;
}

export interface DmarcEvaluationInput {
  jobId: string;
  reporter: string;
  receivedAt: number;
  sourceIp: string;
  headerFrom: string;
  envelopeFrom: string | null;
  policyDomain: string;
  spfResult: string;
  dkim: DkimSignature[];
  dkimAligned: DmarcVerdict;
  spfAligned: DmarcVerdict;
  disposition: DmarcPolicy;
  policy: DmarcPolicy | null;
  subdomainPolicy: DmarcPolicy | null;
  adkim: DmarcAlignmentMode;
  aspf: DmarcAlignmentMode;
  pct: number;
  rua: string[];
  recipientDomain?: string | null;
}

export interface DmarcPublishedPolicy {
  domain: string;
  adkim: DmarcAlignmentMode;
  aspf: DmarcAlignmentMode;
  p: DmarcPolicy;
  sp: DmarcPolicy;
  pct: number;
}

export interface DmarcReportRecord {
  sourceIp: string;
  count: number;
  disposition: DmarcPolicy;
  dkim: DmarcVerdict;
  spf: DmarcVerdict;
  headerFrom: string;
  envelopeFrom: string | null;
  envelopeTo: string | null;
  dkimResults: { domain: string; selector: string | null; result: string }[];
  spfResults: { domain: string; scope: string | null; result: string }[];
  reasons: { type: string; comment: string | null }[];
}

export interface DmarcFeedback {
  orgName: string;
  email: string;
  extraContact: string | null;
  reportId: string;
  begin: number;
  end: number;
  policy: DmarcPublishedPolicy;
  records: DmarcReportRecord[];
}

export interface DmarcRuaTarget {
  address: string;
  maxBytes: number | null;
}

export type DmarcOutgoingStatus = "sent" | "failed" | "skipped";
export type DmarcInboxStatus = "imported" | "duplicate" | "not-a-report" | "failed";

export interface DmarcSettingsView {
  sendingEnabled: boolean;
  reportHour: number;
  inboxes: string[];
  retentionDays: number;
  copyTo: string | null;
}
