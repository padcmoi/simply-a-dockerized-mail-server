export interface Fail2banBan {
  ip: string;
  bannedAt: number;
  expiresAt: number | null;
}

export interface Fail2banJail {
  name: string;
  currentlyBanned: number;
  recentBans: number;
  bantime: number;
  findtime: number;
  maxretry: number;
  bans: Fail2banBan[];
}

export interface Fail2banHistoryEntry {
  jail: string;
  ip: string;
  bannedAt: number;
  expiresAt: number | null;
  banCount: number;
  failures: number;
  matches: string[];
}

export type Fail2banBanned = Record<string, number>;

export interface Fail2banStatus {
  available: boolean;
  jails: Fail2banJail[];
  history: Fail2banHistoryEntry[];
}
