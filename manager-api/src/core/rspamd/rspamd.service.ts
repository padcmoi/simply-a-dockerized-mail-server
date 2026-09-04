import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import {
  resolveSearchColumn,
  resolveSortColumn,
  type PaginatedResult,
  type PaginationQuery,
} from "../common/pagination.validation";
import { readDomainBayes, type RspamdDomainBayes } from "./bayes-redis";

export type { BayesRecipientStat, RspamdDomainBayes } from "./bayes-redis";

export const RSPAMD_HISTORY_SORTABLE_COLUMNS = ["sender_smtp", "rcpt", "action", "score", "size", "time"] as const;
type RspamdSortableColumn = (typeof RSPAMD_HISTORY_SORTABLE_COLUMNS)[number];

// The fields a `searchBy` may name, matching what the free-text search spans
// when it names none. `subject` has no column in the list, which shows the
// envelope and the verdict; it stays searchable, as it always was.
export const RSPAMD_HISTORY_SEARCHABLE_COLUMNS = ["sender_smtp", "rcpt", "subject"] as const;

function searchValues(row: RspamdHistoryRow, key: (typeof RSPAMD_HISTORY_SEARCHABLE_COLUMNS)[number]): string[] {
  switch (key) {
    case "sender_smtp":
      return [row.sender_smtp ?? ""];
    case "rcpt":
      return row.rcpt_smtp ?? [];
    case "subject":
      return [row.subject ?? ""];
  }
}

function sortValue(row: RspamdHistoryRow, key: RspamdSortableColumn): string | number {
  switch (key) {
    case "sender_smtp":
      return row.sender_smtp ?? "";
    case "rcpt":
      return row.rcpt_smtp?.[0] ?? "";
    case "action":
      return row.action ?? "";
    case "score":
      return row.score;
    case "size":
      return row.size;
    case "time":
      return row.unix_time;
  }
}

export interface RspamdActions {
  reject: number;
  "soft reject": number;
  "rewrite subject": number;
  "add header": number;
  greylist: number;
  "no action": number;
}

export interface RspamdBayesStatfile {
  symbol: string;
  type: string;
  users: number;
  revision: number;
}

export interface RspamdStats {
  version: string;
  uptime: number;
  scanned: number;
  learned: number;
  spam_count: number;
  ham_count: number;
  connections: number;
  actions: RspamdActions;
  statfiles: RspamdBayesStatfile[];
}

// Rspamd has no per-domain counterpart to its own server-wide /stat endpoint
// -- this narrower shape is tallied from the same (domain-filtered) /history
// rows the history endpoint already returns, see DomainsRspamdController. The
// Bayes block is the exception: rspamd's per-recipient statfiles carry the
// domain in their key, so those ARE resolvable per domain -- read from Redis,
// see bayes-redis.ts.
export interface RspamdDomainStats {
  scanned: number;
  actions: RspamdActions;
  bayes: RspamdDomainBayes;
}

// "soft reject" has no configurable threshold in rspamd's own /saveactions
// endpoint (always null there) -- exposed here read-only, never part of
// SaveRspamdActionsInput.
export interface RspamdActionThresholds {
  reject: number | null;
  softReject: number | null;
  rewriteSubject: number | null;
  addHeader: number | null;
  greylist: number | null;
}

export interface SaveRspamdActionsInput {
  reject: number | null;
  rewriteSubject: number | null;
  addHeader: number | null;
  greylist: number | null;
}

// This project's shipped baseline (images/rspamd/conf/override.d/actions.conf)
// -- the only place these numbers should be defined. `/saveactions` writes to
// rspamd's own dynamic config (/var/lib/rspamd/rspamd_dynamic), layered on
// top of that static file, so resetting means re-saving these same values,
// not touching the file itself.
export const RSPAMD_FACTORY_ACTIONS: SaveRspamdActionsInput = {
  reject: 15,
  rewriteSubject: null,
  addHeader: 5,
  greylist: null,
};

export interface RspamdHistoryRow {
  "message-id": string;
  ip: string;
  action: string;
  score: number;
  required_score: number;
  size: number;
  time_real: number;
  unix_time: number;
  sender_smtp: string;
  sender_mime: string;
  rcpt_smtp: string[];
  rcpt_mime: string[];
  subject: string;
  user: string;
}

const RSPAMD_BASE_URL = "http://mail-rspamd:11334";

@Injectable()
export class RspamdService {
  async stats(): Promise<RspamdStats> {
    let res: Response;
    try {
      res = await fetch(`${RSPAMD_BASE_URL}/stat`);
    } catch {
      throw new HttpException("Rspamd unreachable", HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!res.ok) {
      throw new HttpException(`Rspamd returned ${res.status}`, HttpStatus.BAD_GATEWAY);
    }
    return res.json() as Promise<RspamdStats>;
  }

  // Per-recipient Bayes learn counts for one domain, read from Redis. Best-effort
  // on purpose: this feeds a secondary widget, so Redis being unreachable returns
  // an empty result rather than failing the whole domain stats response.
  async domainBayes(domain: string): Promise<RspamdDomainBayes> {
    try {
      return await readDomainBayes(domain);
    } catch {
      return { recipients: [], totalHam: 0, totalSpam: 0 };
    }
  }

  async getActions(): Promise<RspamdActionThresholds> {
    let res: Response;
    try {
      res = await fetch(`${RSPAMD_BASE_URL}/actions`);
    } catch {
      throw new HttpException("Rspamd unreachable", HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!res.ok) {
      throw new HttpException(`Rspamd returned ${res.status}`, HttpStatus.BAD_GATEWAY);
    }
    const rows = (await res.json()) as { action: string; value: number | null }[];
    const byName = new Map(rows.map((r) => [r.action, r.value]));
    return {
      reject: byName.get("reject") ?? null,
      softReject: byName.get("soft reject") ?? null,
      rewriteSubject: byName.get("rewrite subject") ?? null,
      addHeader: byName.get("add header") ?? null,
      greylist: byName.get("greylist") ?? null,
    };
  }

  // Rspamd's own array order for /saveactions, reverse-engineered from its
  // webui source (js/app/config.js, ui.saveActions) -- not documented
  // anywhere else. Ordering/non-negativity is validated by the caller
  // (rspamd.validation.ts) before this ever runs: rspamd's own endpoint
  // does not itself reject a malformed array, it just silently applies it.
  async saveActions(input: SaveRspamdActionsInput): Promise<void> {
    const payload = [input.reject, input.rewriteSubject, input.addHeader, input.greylist];
    let res: Response;
    try {
      res = await fetch(`${RSPAMD_BASE_URL}/saveactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new HttpException("Rspamd unreachable", HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!res.ok) {
      throw new HttpException(`Rspamd returned ${res.status}`, HttpStatus.BAD_GATEWAY);
    }
    const body = (await res.json()) as { success?: boolean; error?: string };
    if (!body.success) {
      throw new HttpException(body.error ?? "Rspamd rejected the new thresholds", HttpStatus.BAD_GATEWAY);
    }
  }

  resetActions(): Promise<void> {
    return this.saveActions(RSPAMD_FACTORY_ACTIONS);
  }

  // Overloads: called with 2 args (spamd.controller.ts, useDomainDashboard.ts's
  // per-domain widget) keeps returning a plain array with zero changes; the
  // 3-arg form (rspamd.controller.ts's table endpoint) opts into pagination.
  async history(domain: string | undefined, size?: number): Promise<RspamdHistoryRow[]>;
  async history(
    domain: string | undefined,
    size: number | undefined,
    query: PaginationQuery
  ): Promise<RspamdHistoryRow[] | PaginatedResult<RspamdHistoryRow>>;
  // Rspamd itself has no deeper archive than its ring buffer (`size`,
  // unchanged from before this feature) -- search/pagination/sortDir below
  // operate in-memory over that already-fetched window, `total` is bounded
  // to it.
  async history(
    domain: string | undefined,
    size = 200,
    query?: PaginationQuery
  ): Promise<RspamdHistoryRow[] | PaginatedResult<RspamdHistoryRow>> {
    let res: Response;
    try {
      res = await fetch(`${RSPAMD_BASE_URL}/history?size=${size}`);
    } catch {
      throw new HttpException("Rspamd unreachable", HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!res.ok) {
      throw new HttpException(`Rspamd returned ${res.status}`, HttpStatus.BAD_GATEWAY);
    }
    const data = (await res.json()) as { rows?: RspamdHistoryRow[] };
    let rows = data.rows ?? [];
    if (domain) {
      const suffix = `@${domain}`;
      // A scan belongs to the domain whether the domain SENT it (sender@domain,
      // outbound) or RECEIVED it (rcpt@domain, inbound). Filtering on the
      // recipient alone hid every message a domain sends -- so a domain that
      // only sends (e.g. a service posting to another domain) showed 0 scans
      // despite heavy traffic.
      rows = rows.filter((r) => r.sender_smtp?.endsWith(suffix) || r.rcpt_smtp?.some((rcpt) => rcpt.endsWith(suffix)));
    }

    if (!query || query.limit === undefined) return rows;

    if (query.search) {
      const term = query.search.toLowerCase();
      const searchBy = resolveSearchColumn(query.searchBy, RSPAMD_HISTORY_SEARCHABLE_COLUMNS);
      const fields = searchBy ? [searchBy] : RSPAMD_HISTORY_SEARCHABLE_COLUMNS;
      rows = rows.filter((r) =>
        fields.some((field) => searchValues(r, field).some((value) => value.toLowerCase().includes(term)))
      );
    }
    const sortBy = resolveSortColumn(query.sortBy, RSPAMD_HISTORY_SORTABLE_COLUMNS, "time");
    const dir = query.sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = sortValue(a, sortBy);
      const bv = sortValue(b, sortBy);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });

    const total = rows.length;
    const items = rows.slice(query.offset, query.offset + query.limit);
    return { items, total };
  }
}
