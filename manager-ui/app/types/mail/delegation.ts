// Domain delegations: what a domain granted an account, and the caps a form
// edits on either side of an invitation.

export interface DelegationRow {
  accountId: string;
  accountEmail: string | null;
  maxRecipients: number | null;
  maxAliases: number | null;
  quotaMb: number;
  usedRecipients: number;
  usedAliases: number;
  usedBytes: string;
  grantableMb: number | null;
}

export interface DelegationPendingRow {
  id: number;
  email: string | null;
  note: string | null;
  token: string | null;
  maxRecipients: number | null;
  maxAliases: number | null;
  quotaMb: number;
  expiresAt: string | null;
  grantableMb: number | null;
}

export interface DelegationsPayload {
  grantableMb: number | null;
  delegations: DelegationRow[];
  pendingInvitations: DelegationPendingRow[];
}

export interface MyDelegation {
  domainId: number;
  domain: string;
  maxRecipients: number | null;
  maxAliases: number | null;
  quotaMb: number;
  usedRecipients: number;
  usedAliases: number;
  usedBytes: string;
}

export interface DelegationCapsForm {
  unlimitedRecipients: boolean;
  maxRecipients: number;
  unlimitedAliases: boolean;
  maxAliases: number;
  quotaMb: number;
  noExpiry: boolean;
  expiresDays: number;
}
