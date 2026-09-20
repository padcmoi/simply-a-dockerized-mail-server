import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Fail2banBan, Fail2banHistoryEntry } from "./fail2ban.types";

interface JailRow {
  name: string;
  enabled: number;
}

interface BanRow {
  jail: string;
  ip: string;
  timeofban: number;
  bantime: number;
}

interface HistoryRow extends BanRow {
  bancount: number;
  data: string | Uint8Array | null;
}

const HISTORY_LIMIT = 200;

@Injectable()
export class Fail2banDbService {
  private readonly log = new Logger(Fail2banDbService.name);
  private readonly path: string;

  constructor(cfg: ConfigService) {
    this.path = cfg.get<string>("FAIL2BAN_DATABASE") ?? "/var/lib/fail2ban/fail2ban.sqlite3";
  }

  jails() {
    return this.read<JailRow>("SELECT name, enabled FROM jails ORDER BY name")
      .filter((row) => row.enabled)
      .map((row) => row.name);
  }

  // Only the bans that are still running. fail2ban keeps a row in `bips` long
  // after it has let an address go, until `dbpurgeage` sweeps it a week later,
  // so a jail read whole answers with addresses nothing blocks any more. A
  // bantime below zero never ends, which is what the manager's own jail sets.
  bans() {
    const banned = new Map<string, Fail2banBan[]>();
    const now = Math.floor(Date.now() / 1000);
    for (const row of this.read<BanRow>(
      "SELECT jail, ip, timeofban, bantime FROM bips WHERE bantime < 0 OR timeofban + bantime > ? ORDER BY timeofban DESC",
      now
    )) {
      banned.set(row.jail, [...(banned.get(row.jail) ?? []), { ip: row.ip, ...this.window(row) }]);
    }
    return banned;
  }

  recentBans() {
    const counts = new Map<string, number>();
    for (const row of this.read<{ jail: string; total: number }>("SELECT jail, COUNT(*) AS total FROM bans GROUP BY jail")) {
      counts.set(row.jail, Number(row.total));
    }
    return counts;
  }

  history(): Fail2banHistoryEntry[] {
    const rows = this.read<HistoryRow>(
      "SELECT jail, ip, timeofban, bantime, bancount, data FROM bans ORDER BY timeofban DESC LIMIT ?",
      HISTORY_LIMIT
    );
    return rows.map((row) => {
      const { matches, failures } = this.details(row.data);
      return { jail: row.jail, ip: row.ip, ...this.window(row), banCount: Number(row.bancount), failures, matches };
    });
  }

  private window({ timeofban, bantime }: BanRow) {
    const bannedAt = Number(timeofban) * 1000;
    return { bannedAt, expiresAt: Number(bantime) < 0 ? null : bannedAt + Number(bantime) * 1000 };
  }

  private details(data: string | Uint8Array | null) {
    try {
      const text = typeof data === "string" ? data : data ? Buffer.from(data).toString("utf8") : "";
      const parsed = text ? (JSON.parse(text) as { matches?: unknown[]; failures?: number }) : {};
      const matches = (parsed.matches ?? []).map((match) => (Array.isArray(match) ? match.join("") : String(match)));
      return { matches, failures: Number(parsed.failures ?? 0) };
    } catch {
      return { matches: [] as string[], failures: 0 };
    }
  }

  private read<T>(query: string, ...params: (string | number)[]): T[] {
    if (!existsSync(this.path)) return [];
    let db: DatabaseSync | null = null;
    try {
      db = new DatabaseSync(this.path, { readOnly: true });
      return db.prepare(query).all(...params) as T[];
    } catch (e) {
      this.log.warn(`reading the fail2ban database failed: ${(e as Error).message}`);
      return [];
    } finally {
      db?.close();
    }
  }
}
