// What one domain's dashboard reads: the domain row, its collections, its
// quota counters and the DKIM material the admin panel shares with it.

export interface Domain {
  id: number;
  domain: string;
  quota: string;
  active: number;
  ownerId?: number | null;
  ownerEmail?: string | null;
}

export interface Recipient {
  id: number;
  active: number;
  email: string;
  quota: string;
}

export interface Alias {
  id: number;
}

export interface QuotaDomain {
  bytes: string;
  messages: string;
  lastActivity: string;
}

export interface QuotaPayload {
  domain: QuotaDomain | null;
  reservedForAccountsBytes: string;
  recipients: { id: number; email: string; bytes: string; quota: string }[];
}

export interface MailboxEntry {
  id: number;
  email: string;
  bytes: string;
  quota: string;
}

export interface DkimKey {
  domain: string;
  selector: string;
  dnsName: string;
  txtRecord: string;
}

export interface DkimCheckResult {
  domain: string;
  hasKeyInDatabase: boolean;
  match: boolean;
  checkedAt: string;
  error: string | null;
  staleSelectorFound: { selector: string; queriedName: string; txtRecord: string } | null;
  expected: { selector: string; queriedName: string; value: string } | null;
  found: { value: string } | null;
}

export interface DomainDashboardData {
  domain: Domain | null;
  recipients: Recipient[];
  aliases: Alias[];
  quota: QuotaDomain | null;
  reservedForAccountsBytes: string;
  topMailboxes: MailboxEntry[];
}
