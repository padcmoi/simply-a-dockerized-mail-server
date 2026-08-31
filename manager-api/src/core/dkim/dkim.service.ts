import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DkimKeyEntity } from "../entities/dkim-key.entity";

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

  constructor(
    cfg: ConfigService,
    @InjectRepository(DkimKeyEntity)
    private readonly repo: Repository<DkimKeyEntity>
  ) {
    this.baseUrl = cfg.get<string>("OPENDKIM_API_URL") ?? "http://mail-opendkim:8080";
  }

  // List always reads from the dkim_keys table. If the table is empty for
  // this domain we look at the opendkim sidecar once and persist whatever
  // it returns -- this self-heals drift (rows in the sidecar that never
  // made it into the DB, e.g. domains provisioned by an older codepath).
  async list(domain: string): Promise<DkimKey[]> {
    const persisted = await this.repo.find({
      where: { domain },
      order: { selector: "ASC" },
    });
    if (persisted.length > 0) return persisted.map((r) => this.toDkimKey(r));

    const fromSidecar = await this.fetchFromSidecar(domain).catch(() => [] as DkimKey[]);
    if (fromSidecar.length === 0) return [];
    await this.persist(fromSidecar);
    return fromSidecar;
  }

  // Generate a new selector through the opendkim sidecar, then persist the
  // returned material. `upsert` on (domain, selector) so a re-run with the
  // same selector idempotently updates instead of throwing on the UNIQUE.
  async create(domain: string, selector?: string): Promise<DkimKey> {
    const generated = await this.req<DkimKey>("POST", `/keys/${encodeURIComponent(domain)}`, selector ? { selector } : {});
    await this.persist([generated]);
    return generated;
  }

  async remove(domain: string, selector: string): Promise<DeleteResult> {
    const r = await this.req<DeleteResult>(
      "DELETE",
      `/keys/${encodeURIComponent(domain)}?selector=${encodeURIComponent(selector)}`
    );
    await this.repo.delete({ domain, selector });
    return r;
  }

  // Cascade-friendly cleanup: list + remove each, then a belt-and-suspenders
  // DELETE on any stale row still attached to the domain (e.g. if a previous
  // remove() got an HTTP error from the sidecar but the table still held the
  // entry).
  async removeAll(domain: string): Promise<void> {
    const keys = await this.list(domain).catch(() => [] as DkimKey[]);
    await Promise.all(keys.map((k) => this.remove(domain, k.selector).catch(() => undefined)));
    await this.repo.delete({ domain });
  }

  private async persist(keys: DkimKey[]): Promise<void> {
    if (keys.length === 0) return;
    await this.repo.upsert(
      keys.map((k) => ({
        domain: k.domain,
        selector: k.selector,
        dnsName: k.dnsName,
        publicKey: this.extractPublicKey(k.txtRecord),
        txtRecord: k.txtRecord,
      })),
      ["domain", "selector"]
    );
  }

  private async fetchFromSidecar(domain: string): Promise<DkimKey[]> {
    const r = await this.req<{ keys: DkimKey[] }>("GET", `/keys/${encodeURIComponent(domain)}`);
    return r.keys ?? [];
  }

  // `txtRecord` is of the form `v=DKIM1; k=rsa; p=BASE64...`. The migration
  // declared `public_key TEXT NOT NULL`, so we always need a value. Stripping
  // the `p=` segment gives us the raw public key body, which is the same
  // data, just without the DKIM record header.
  private extractPublicKey(txtRecord: string): string {
    const match = txtRecord.match(/p=([^;\s]+)/);
    return match ? match[1] : "";
  }

  private toDkimKey(row: DkimKeyEntity): DkimKey {
    return {
      domain: row.domain,
      selector: row.selector,
      dnsName: row.dnsName,
      txtRecord: row.txtRecord,
    };
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
}
