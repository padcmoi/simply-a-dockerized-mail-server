// API keys as the console lists, reveals and audits them.

export interface ApiTokenItem {
  id: number;
  name: string;
  clientId: string;
  allowedIps: string[] | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  secretAvailable: boolean;
}

export interface RevealedToken {
  id: number;
  name: string;
  clientId: string;
  key: string | null;
}

export interface CreatedToken {
  id: number;
  name: string;
  clientId: string;
  key: string;
  allowedIps: string[] | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AccessEntry {
  id: string;
  method: string;
  route: string;
  statusCode: number;
  clientIp: string;
  country: string;
  userAgent: string;
  origin: string;
  referer: string;
  durationMs: number;
  createdAt: string;
}
