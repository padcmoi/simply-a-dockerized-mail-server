// What the administration dashboard reads, from whichever source answered.

export interface DashboardDomain {
  id: number;
  domain: string;
  quota: string;
  active: number;
  lastActivity?: string;
}

export interface DashboardRecipient {
  id: number;
  email: string;
  domain: string;
  active: number;
  lastActivity?: string;
}

export interface DashboardReject {
  id: number;
  sender: string;
  enabled: number;
}

// One bar of the recipients-per-domain chart.
export interface BarItem {
  domain: string;
  count: number;
}

// What the disk donut draws; assignable space is derived, not drawn.
export interface DiskInput {
  totalBytes: number;
  freeBytes: number;
  reservedBytes: number;
}

export interface DashboardData {
  domains: DashboardDomain[];
  recipients: DashboardRecipient[];
  aliases: OwnedAlias[];
  rejects: DashboardReject[];
  disk: DomainDisk | null;
}

// The server-computed overview (SQL aggregates + disk), pushed over WS to
// anyone allowed to see every domain. It carries counts and the small
// recent/per-domain lists rather than the raw ~thousands of rows the REST
// fallback fans out for -- lighter, and the single source of truth when
// present.
export interface DashboardSummary {
  domains: { total: number; active: number };
  recipients: { total: number; active: number };
  aliases: { total: number };
  blockedSenders: { total: number; enabled: number };
  disk: DomainDisk | null;
  recipientsPerDomain: { domain: string; count: number }[];
  recentDomains: { id: number; domain: string; quota: string; active: number }[];
  recentRecipients: { id: number; email: string; domain: string; active: number }[];
}
