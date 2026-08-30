// Rspamd's figures, server-wide and per domain, plus the thresholds a form
// writes back.

export interface RspamdActions {
  reject: number;
  "soft reject": number;
  "rewrite subject": number;
  "add header": number;
  greylist: number;
  "no action": number;
}

export interface RspamdBayesStatfile {
  symbol: string;
  type: string;
  users: number;
  revision: number;
}

export interface RspamdBayesRecipient {
  recipient: string;
  learnsHam: number;
  learnsSpam: number;
}

export interface RspamdDomainBayes {
  recipients: RspamdBayesRecipient[];
  totalHam: number;
  totalSpam: number;
}

export interface RspamdStats {
  scanned: number;
  actions: RspamdActions;
  // Global-only (server-wide Bayes classifier): absent on the domain-scoped
  // endpoint, which only ever returns { scanned, actions }.
  learned?: number;
  statfiles?: RspamdBayesStatfile[];
  // Domain-scoped only: per-recipient Bayes learn counts for this domain,
  // absent on the server-wide /rspamd endpoint.
  bayes?: RspamdDomainBayes;
}

export interface RspamdHistoryItem {
  id: string;
  sender_smtp: string;
  rcpt: string;
  action: string;
  score: number;
  required_score: number;
  size: number;
  time: string;
}

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

export interface DomainRspamdStats {
  scanned: number;
  actions: { reject: number; greylist: number; "no action": number } & Record<string, number>;
}

export interface RspamdHistoryRow {
  "message-id": string;
  ip: string;
  action: string;
  score: number;
  required_score: number;
  size: number;
  unix_time: number;
  sender_smtp: string;
  rcpt_smtp: string[];
  subject: string;
}
