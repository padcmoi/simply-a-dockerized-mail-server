// A domain, in the shapes the API answers with.

export interface DomainDisk {
  totalBytes: number;
  freeBytes: number;
  reservedBytes: number;
  assignableBytes: number;
}

// The four fields shared by the current-domain store and the domain picker.
export interface DomainInfo {
  id: number;
  domain: string;
  quota: string;
  active: number;
}

// The domains list's own row: quota plus what the domain actually stores.
export interface DomainRow {
  id: number;
  domain: string;
  quota: string;
  usedBytes: string;
  active: number;
}

// What an account owns, from the personal space and the account detail.
export interface OwnedDomain {
  id: number;
  domain: string;
  active: boolean;
  quota: string;
}

// Just enough of a domain to pick it from a list.
export interface DomainOption {
  id: number;
  domain: string;
}

export interface QuotaRow {
  id: number;
  domain: string;
  email?: string;
  // Absent on the domain aggregate row (virtual_quota_domains holds counters
  // only); joined from virtual_users on every recipient row.
  quota?: string;
  bytes: string;
  messages: string;
  lastActivity: string;
}
