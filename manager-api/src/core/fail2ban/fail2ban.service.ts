import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface Fail2banBan {
  ip: string;
  bannedAt: number;
  expiresAt: number | null;
}

export interface Fail2banJail {
  name: string;
  currentlyFailed: number;
  totalFailed: number;
  currentlyBanned: number;
  totalBanned: number;
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

export interface Fail2banStatus {
  available: boolean;
  jails: Fail2banJail[];
  history: Fail2banHistoryEntry[];
}

export type Fail2banBanned = Record<string, number>;

const TIMEOUT_MS = 15_000;
const BANNED_TTL_MS = 10_000;

@Injectable()
export class Fail2banService {
  private readonly log = new Logger(Fail2banService.name);
  private readonly baseUrl: string;
  private banned: { at: number; value: Fail2banBanned | null } = { at: 0, value: null };
  private refreshing: Promise<void> | null = null;

  constructor(cfg: ConfigService) {
    this.baseUrl = cfg.get<string>("FAIL2BAN_API_URL") ?? "http://172.200.0.1:8081";
  }

  async status(): Promise<Fail2banStatus> {
    try {
      const { jails, history } = await this.req<{ jails: Fail2banJail[]; history?: Fail2banHistoryEntry[] }>("GET", "/status");
      return { available: true, jails, history: history ?? [] };
    } catch {
      return { available: false, jails: [], history: [] };
    }
  }

  latestBanned(): Fail2banBanned | null {
    if (!this.refreshing && Date.now() - this.banned.at >= BANNED_TTL_MS) {
      this.refreshing = this.req<{ banned: Fail2banBanned }>("GET", "/banned")
        .then(({ banned }) => banned)
        .catch(() => null)
        .then((value) => {
          this.banned = { at: Date.now(), value };
        })
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.banned.value;
  }

  ban(ip: string) {
    return this.req<Fail2banJail>("POST", "/ban", { ip });
  }

  unban(jail: string, ip: string) {
    return this.req<Fail2banJail>("POST", `/jails/${encodeURIComponent(jail)}/unban`, { ip });
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      this.log.warn(`fail2ban-api ${method} ${path} unreachable: ${(e as Error).message}`);
      throw new ServiceUnavailableException("Fail2ban is out of reach");
    }

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return payload as T;

    const message = typeof payload.error === "string" ? payload.error : `fail2ban-api ${method} ${path} -> ${res.status}`;
    if (res.status === 404) throw new NotFoundException("Unknown jail");
    if (res.status === 400) throw new BadRequestException("Invalid address");
    this.log.warn(message);
    throw new ServiceUnavailableException("Fail2ban is out of reach");
  }
}
