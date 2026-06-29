import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type DkimKey = {
  domain: string;
  selector: string;
  dnsName: string;
  txtRecord: string;
};

type DeleteResult = {
  domain: string;
  selector: string;
  removedFiles: string[];
  removedKeyTable: number;
  removedSigningTable: number;
};

@Injectable()
export class DkimService {
  private readonly log = new Logger(DkimService.name);
  private readonly baseUrl: string;

  constructor(cfg: ConfigService) {
    this.baseUrl = cfg.get<string>("OPENDKIM_API_URL") ?? "http://mail-opendkim:8080";
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message = (payload.error as string) ?? `dkim-api ${method} ${path} -> ${res.status}`;
      this.log.warn(`${message} (detail=${JSON.stringify(payload)})`);
      throw new HttpException(message, res.status);
    }
    return payload as T;
  }

  async list(domain: string) {
    const r = await this.req<{ keys: DkimKey[] }>("GET", `/keys/${encodeURIComponent(domain)}`);
    return r.keys;
  }

  async create(domain: string, selector?: string) {
    return this.req<DkimKey>("POST", `/keys/${encodeURIComponent(domain)}`, selector ? { selector } : {});
  }

  async remove(domain: string, selector: string) {
    return this.req<DeleteResult>("DELETE", `/keys/${encodeURIComponent(domain)}?selector=${encodeURIComponent(selector)}`);
  }

  async removeAll(domain: string) {
    const keys = await this.list(domain).catch(() => [] as DkimKey[]);
    await Promise.all(keys.map((k) => this.remove(domain, k.selector).catch(() => undefined)));
  }
}
