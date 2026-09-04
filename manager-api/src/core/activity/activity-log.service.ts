import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { resolveSearchColumn, resolveSortColumn, type PaginatedResult } from "../common/pagination.validation";
import { Account } from "../entities/account.entity";
import { ActivityLog } from "../entities/activity-log.entity";
import { countriesFor } from "../common/geoip";
import { currentActivityContext } from "./activity-context";
import type { ActivityListQuery } from "./activity-log.validation";

// Every action a line may carry, which is also what the interface's filter
// offers and what it translates. A new event is a new name here first.
export const ACTIVITY_ACTIONS = [
  "auth.login",
  "auth.login.refused",
  "auth.logout",
  "auth.session.revoked",
  "auth.two-factor.refused",
  "auth.two-factor.enabled",
  "auth.two-factor.disabled",
  "auth.two-factor.recovery-codes-regenerated",
  "auth.two-factor.reset",
  "auth.password.changed",
  "auth.email.changed",
  "profile.updated",
  "accounts.updated",
  "accounts.deleted",
  "recipients.created",
  "recipients.updated",
  "recipients.deleted",
  "aliases.created",
  "aliases.updated",
  "aliases.deleted",
  "tickets.created",
  "tickets.replied",
  "tickets.message-edited",
  "tickets.taken",
  "tickets.status-changed",
  "api-tokens.created",
  "api-tokens.revoked",
  "api-tokens.deleted",
  "api-tokens.regenerated",
  "api-tokens.revealed",
  "delegations.accepted",
  "delegations.claimed",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface RecordActivityInput {
  action: ActivityAction;
  // Who did it. Left out, the request's own account; null for a sign-in that
  // was refused before there was one.
  actorId?: string | null;
  // The account it concerns, when not the actor: an administrator editing
  // someone else's account writes a line that person's journal shows too.
  subjectId?: string | null;
  entity?: { type: string; id?: string | number | null; label?: string | null };
  // Small facts, never content: the fields that changed, a status, an email.
  details?: Record<string, unknown> | null;
}

export const ACTIVITY_SORTABLE_COLUMNS = ["createdAt", "action", "actorEmail"] as const;
export const ACTIVITY_SEARCHABLE_COLUMNS = ["action", "entityLabel", "ip", "userAgent", "actorEmail"] as const;

const ACTIVITY_SEARCH_EXPR: Record<(typeof ACTIVITY_SEARCHABLE_COLUMNS)[number], string> = {
  action: "l.action LIKE :search",
  entityLabel: "l.entity_label LIKE :search",
  ip: "l.ip LIKE :search",
  userAgent: "l.user_agent LIKE :search",
  actorEmail: "a.email LIKE :search",
};

const DEFAULT_PAGE_SIZE = 25;

export interface ActivityRow {
  id: string;
  action: ActivityAction;
  actorId: string | null;
  actorEmail: string | null;
  subjectId: string | null;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  country: string;
  userAgent: string | null;
  createdAt: Date;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(@InjectRepository(ActivityLog) private readonly rows: Repository<ActivityLog>) {}

  // Never throws: a journal that could fail the action it describes would be
  // a second way for that action to fail, and the action is what matters.
  async record(input: RecordActivityInput) {
    const context = currentActivityContext();
    const actorId = input.actorId === undefined ? (context?.actorId() ?? null) : input.actorId;
    try {
      await this.rows.save(
        this.rows.create({
          actorId,
          subjectId: input.subjectId === undefined ? actorId : input.subjectId,
          action: input.action,
          entityType: input.entity?.type ?? null,
          entityId: input.entity?.id === undefined || input.entity.id === null ? null : String(input.entity.id),
          entityLabel: input.entity?.label ?? null,
          details: input.details ?? null,
          ip: context?.ip ?? null,
          userAgent: context?.userAgent ?? null,
        })
      );
    } catch (err) {
      this.logger.warn(`Activity line "${input.action}" was not written: ${(err as Error).message}`);
    }
  }

  // The account's own journal: what it did, and what was done to it.
  listForAccount(accountId: string, query: ActivityListQuery) {
    return this.page(query, (qb) => qb.where("(l.actor_id = :me OR l.subject_id = :me)", { me: accountId }));
  }

  // Everyone's, for the server page; narrowed to one account when asked.
  listAll(query: ActivityListQuery) {
    return this.page(query, (qb) => (query.actorId ? qb.where("l.actor_id = :actor", { actor: query.actorId }) : qb));
  }

  private async page(
    query: ActivityListQuery,
    scope: (
      qb: ReturnType<Repository<ActivityLog>["createQueryBuilder"]>
    ) => ReturnType<Repository<ActivityLog>["createQueryBuilder"]>
  ): Promise<PaginatedResult<ActivityRow>> {
    const qb = scope(
      this.rows.createQueryBuilder("l").leftJoin(Account, "a", "a.id = l.actor_id").addSelect("a.email", "actorEmail")
    );
    if (query.action) qb.andWhere("l.action = :action", { action: query.action });
    if (query.search) {
      const searchBy = resolveSearchColumn(query.searchBy, ACTIVITY_SEARCHABLE_COLUMNS);
      const expressions = searchBy ? [ACTIVITY_SEARCH_EXPR[searchBy]] : Object.values(ACTIVITY_SEARCH_EXPR);
      qb.andWhere(`(${expressions.join(" OR ")})`, { search: `%${query.search}%` });
    }
    const total = await qb.getCount();
    const sortBy = resolveSortColumn(query.sortBy, ACTIVITY_SORTABLE_COLUMNS, "createdAt");
    const dir = query.sortDir === "asc" ? "ASC" : "DESC";
    if (sortBy === "actorEmail") qb.orderBy("actorEmail", dir).addOrderBy("l.id", dir);
    else qb.orderBy(`l.${sortBy}`, dir).addOrderBy("l.id", dir);
    const { entities, raw } = await qb
      .skip(query.offset)
      .take(query.limit ?? DEFAULT_PAGE_SIZE)
      .getRawAndEntities();
    const countries = await countriesFor(entities.map((row) => row.ip).filter((ip): ip is string => !!ip));
    const items = entities.map((row, i) => ({
      id: row.id,
      action: row.action as ActivityAction,
      actorId: row.actorId,
      actorEmail: (raw[i] as { actorEmail?: string | null } | undefined)?.actorEmail ?? null,
      subjectId: row.subjectId,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      details: row.details,
      ip: row.ip,
      country: (row.ip && countries.get(row.ip)) || "",
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    }));
    return { items, total };
  }
}
