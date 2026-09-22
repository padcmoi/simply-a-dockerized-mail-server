export type DmarcOutgoingStatus = "sent" | "failed" | "skipped";
export type DmarcInboxStatus = "imported" | "duplicate" | "not-a-report" | "failed";

export interface DmarcRunSummary {
  day: string;
  domains: number;
  sent: number;
  failed: number;
  skipped: number;
  unchanged: number;
}

export interface DmarcScanSummary {
  mailboxes: number;
  scanned: number;
  imported: number;
  duplicates: number;
  ignored: number;
  failed: number;
  deleted: number;
}

export interface DmarcDomainSummary {
  domain: string;
  reports: number;
  reporters: number;
  messages: number;
  dmarcPass: number;
  dkimPass: number;
  spfPass: number;
  lastPeriodEnd: number | null;
}

export interface DmarcOverview {
  settings: { sendingEnabled: boolean; reportHour: number; inboxes: string[] };
  hostedDomains: string[];
  ingest: { lastRunAt: number | null; lastCount: number; evaluations24h: number };
  outgoing: { lastRunAt: number | null; lastSummary: DmarcRunSummary | null; sent: number; failed: number; skipped: number };
  inbox: { lastRunAt: number | null; imported: number; duplicate: number; ignored: number; failed: number };
  domains: DmarcDomainSummary[];
}

export interface DmarcIncomingReport {
  id: number;
  orgName: string;
  orgEmail: string;
  extraContact: string | null;
  reportId: string;
  domain: string;
  periodBegin: number;
  periodEnd: number;
  adkim: string;
  aspf: string;
  p: string;
  sp: string;
  pct: number;
  records: number;
  messages: number;
  dmarcPass: number;
  dkimPass: number;
  spfPass: number;
  mailbox: string;
  receivedAt: string;
}

export interface DmarcIncomingRow {
  id: number;
  sourceIp: string;
  count: number;
  disposition: string;
  dkim: string;
  spf: string;
  headerFrom: string;
  envelopeFrom: string | null;
  envelopeTo: string | null;
  dkimResults: { domain: string; selector: string | null; result: string }[];
  spfResults: { domain: string; scope: string | null; result: string }[];
  reasons: { type: string; comment: string | null }[];
}

export interface DmarcIncomingDetail extends DmarcIncomingReport {
  rows: DmarcIncomingRow[];
}

export interface DmarcOutgoingReport {
  id: number;
  reportId: string;
  reporterDomain: string;
  policyDomain: string;
  recipient: string;
  periodBegin: number;
  periodEnd: number;
  records: number;
  messages: number;
  sizeBytes: number;
  status: DmarcOutgoingStatus;
  reason: string | null;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

export interface DmarcInboxMessage {
  id: number;
  mailbox: string;
  messageKey: string;
  status: DmarcInboxStatus;
  detail: string | null;
  messageId: string | null;
  sender: string | null;
  subject: string | null;
  reports: number;
  scannedAt: string;
}

export interface DmarcSettings {
  sendingEnabled: boolean;
  reportHour: number;
  inboxes: string[];
  retentionDays: number;
}

export interface DmarcXml {
  filename: string;
  xml: string;
}

export interface DmarcRecord {
  dnsName: string;
  txtRecord: string;
  mailbox: string;
  published: string | null;
  reportsHere: boolean;
  error: string | null;
}
