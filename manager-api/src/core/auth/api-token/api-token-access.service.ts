import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Like, Repository } from "typeorm";
import { countriesFor } from "../../common/geoip";
import { resolveSortColumn, type PaginationQuery } from "../../common/pagination.validation";
import { ApiToken } from "./api-token.entity";
import { ApiTokenAccess } from "./api-token-access.entity";

export const API_TOKEN_ACCESS_SORTABLE_COLUMNS = [
  "createdAt",
  "method",
  "route",
  "statusCode",
  "clientIp",
  "durationMs",
] as const;

const PURGE_EVERY_MS = 3_600_000;
const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_PAGE_SIZE = 25;

export interface RecordAccessInput {
  clientId: string;
  method: string;
  route: string;
  statusCode: number;
  clientIp: string;
  userAgent: string;
  origin: string;
  referer: string;
  durationMs: number;
}

@Injectable()
export class ApiTokenAccessService {
  private readonly logger = new Logger(ApiTokenAccessService.name);
  private purgedAt = 0;

  constructor(
    @InjectRepository(ApiTokenAccess) private readonly repo: Repository<ApiTokenAccess>,
    @InjectRepository(ApiToken) private readonly tokens: Repository<ApiToken>
  ) {}

  private get retentionDays(): number {
    const configured = Number(process.env.MANAGER_API_TOKEN_ACCESS_RETENTION_DAYS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RETENTION_DAYS;
  }

  record(entry: RecordAccessInput): void {
    void this.persist(entry).catch((err: unknown) => {
      this.logger.warn(`Access trail write failed for ${entry.method} ${entry.route}: ${(err as Error).message}`);
    });
  }

  private async persist(entry: RecordAccessInput): Promise<void> {
    const token = await this.tokens.findOne({ where: { clientId: entry.clientId }, select: { id: true } });
    if (!token) return;

    await this.repo.insert({
      tokenId: token.id,
      method: entry.method.slice(0, 10),
      route: entry.route.slice(0, 512),
      statusCode: entry.statusCode,
      clientIp: entry.clientIp.slice(0, 45),
      userAgent: entry.userAgent.slice(0, 512),
      origin: entry.origin.slice(0, 255),
      referer: entry.referer.slice(0, 512),
      durationMs: entry.durationMs,
    });

    await this.purgeExpired();
  }

  private async purgeExpired(): Promise<void> {
    const now = Date.now();
    if (now - this.purgedAt < PURGE_EVERY_MS) return;
    this.purgedAt = now;

    try {
      await this.repo.delete({ createdAt: LessThan(new Date(now - this.retentionDays * 86_400_000)) });
    } catch (err: unknown) {
      this.logger.warn(`Access trail purge failed: ${(err as Error).message}`);
    }
  }

  async list(accountId: string, tokenId: number, query: PaginationQuery) {
    const token = await this.tokens.findOne({ where: { id: tokenId, accountId } });
    if (!token) throw new NotFoundException("Token not found");

    const sortBy = resolveSortColumn(query.sortBy, API_TOKEN_ACCESS_SORTABLE_COLUMNS, "createdAt");
    const term = query.search ? Like(`%${query.search}%`) : null;
    const where = term
      ? [
          { tokenId, route: term },
          { tokenId, clientIp: term },
          { tokenId, userAgent: term },
          { tokenId, origin: term },
          { tokenId, method: term },
        ]
      : { tokenId };

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit ?? DEFAULT_PAGE_SIZE,
    });

    const countries = await countriesFor(items.map((row) => row.clientIp));

    return { items: items.map((row) => ({ ...row, country: countries.get(row.clientIp) ?? "" })), total };
  }
}
