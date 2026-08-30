// A mailbox, in the shapes the API answers with.

// The administration list's row: quota and usage plus the edit stamp.
export interface RecipientRow {
  id: number;
  email: string;
  quota: string;
  usedBytes: string;
  active: number;
  // `virtual_users.last_activity` carries `ON UPDATE current_timestamp()`: it
  // stamps the row's last edit, not mail traffic. Postfix-legacy name, kept.
  lastActivity: string | null;
}

// What the edit page loads: no activity stamp, but the owner it can hand over.
export interface RecipientDetail {
  id: number;
  email: string;
  quota: string;
  usedBytes: string;
  active: number;
  ownerEmail: string | null;
}

// What an account owns, from the admin account detail and the profile.
export interface OwnedRecipientSummary {
  id: number;
  email: string;
  domain: string;
  active: boolean;
  quota: string;
}

// The personal space's reading of the same mailbox, usage included.
export interface OwnedRecipient extends OwnedRecipientSummary {
  usedBytes: string;
}

export interface RecipientHeadroom {
  domainQuota: number;
  allocated: number;
  available: number;
}
