import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Fail2banDbService } from "./fail2ban-db.service";
import type { Fail2banBanned, Fail2banJail, Fail2banStatus } from "./fail2ban.types";

export * from "./fail2ban.types";

const MANAGER_JAIL = "manager";
const TIMEOUT_MS = 15_000;

type Rules = Pick<Fail2banJail, "bantime" | "findtime" | "maxretry">;

@Injectable()
export class Fail2banService {
  private readonly log = new Logger(Fail2banService.name);
  private readonly baseUrl: string;
  private readonly rules: Rules;

  constructor(
    cfg: ConfigService,
    private readonly db: Fail2banDbService
  ) {
    this.baseUrl = cfg.get<string>("FAIL2BAN_API_URL") ?? "http://172.200.0.1:8081";
    this.rules = {
      bantime: Number(cfg.get<string>("FAIL2BAN_BANTIME") ?? 3600),
      findtime: Number(cfg.get<string>("FAIL2BAN_FINDTIME") ?? 300),
      maxretry: Number(cfg.get<string>("FAIL2BAN_MAXRETRY") ?? 5),
    };
  }

  status(): Fail2banStatus {
    const names = this.db.jails();
    const banned = this.db.bans();
    const recent = this.db.recentBans();

    return {
      available: names.length > 0,
      jails: names.map((name) => ({
        name,
        currentlyBanned: banned.get(name)?.length ?? 0,
        recentBans: recent.get(name) ?? 0,
        ...this.rulesOf(name),
        bans: banned.get(name) ?? [],
      })),
      history: this.db.history(),
    };
  }

  latestBanned(): Fail2banBanned | null {
    const names = this.db.jails();
    if (!names.length) return null;
    const banned = this.db.bans();
    return Object.fromEntries(names.map((name) => [name, banned.get(name)?.length ?? 0]));
  }

  async ban(ip: string) {
    await this.req("POST", "/ban", { ip });
    return this.jail(MANAGER_JAIL);
  }

  async unban(jail: string, ip: string) {
    await this.req("POST", `/jails/${encodeURIComponent(jail)}/unban`, { ip });
    return this.jail(jail);
  }

  private jail(name: string) {
    const found = this.status().jails.find((jail) => jail.name === name);
    if (!found) throw new NotFoundException("Unknown jail");
    return found;
  }

  private rulesOf(name: string): Rules {
    return name === MANAGER_JAIL ? { ...this.rules, bantime: -1, maxretry: 1 } : this.rules;
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
