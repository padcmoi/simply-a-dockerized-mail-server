// Sessions as the administration and the profile list them.

export interface SessionRow {
  id: number;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
  active: boolean;
  // Seen within the last minute: currently in use, not just valid.
  online: boolean;
}

export interface SessionAccountSummary {
  accountId: string;
  email: string | null;
  displayName: string | null;
  activeCount: number;
  expiredCount: number;
  online: boolean;
}

export interface AccountSessionSummary extends SessionAccountSummary {
  // Last-seen among the account's active sessions: the active section's
  // "seen X ago" once it is no longer online.
  lastSeenAt: string | null;
  // Last-seen among the account's expired sessions: the expired table's column.
  // Kept distinct so an expired row never borrows the active session's time.
  expiredLastSeenAt: string | null;
}
