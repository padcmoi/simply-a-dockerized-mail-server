import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

interface RspamdActions {
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

  async history(domain?: string, size = 200): Promise<RspamdHistoryRow[]> {
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
    const rows = data.rows ?? [];
    if (!domain) return rows;
    const suffix = `@${domain}`;
    return rows.filter((r) => r.rcpt_smtp?.some((rcpt) => rcpt.endsWith(suffix)));
  }
}
