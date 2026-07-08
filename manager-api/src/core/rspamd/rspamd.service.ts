import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { resolveSortColumn, type PaginatedResult, type PaginationQuery } from "../common/pagination.validation";

export const RSPAMD_HISTORY_SORTABLE_COLUMNS = ["sender_smtp", "rcpt", "action", "score", "size", "time"] as const;
type RspamdSortableColumn = (typeof RSPAMD_HISTORY_SORTABLE_COLUMNS)[number];

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

export interface RspamdStats {
  version: string;
  uptime: number;
  scanned: number;
  learned: number;
  spam_count: number;
  ham_count: number;
  connections: number;
  actions: RspamdActions;
}

// Rspamd has no per-domain counterpart to its own server-wide /stat endpoint
// -- this narrower shape is tallied from the same (domain-filtered) /history
// rows the history endpoint already returns, see DomainsRspamdController.
export interface RspamdDomainStats {
  scanned: number;
  actions: RspamdActions;
}

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
      rows = rows.filter((r) => r.rcpt_smtp?.some((rcpt) => rcpt.endsWith(suffix)));
    }

    if (!query || query.limit === undefined) return rows;

    if (query.search) {
      const term = query.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.sender_smtp?.toLowerCase().includes(term) ||
          r.rcpt_smtp?.some((rcpt) => rcpt.toLowerCase().includes(term)) ||
          r.subject?.toLowerCase().includes(term)
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
