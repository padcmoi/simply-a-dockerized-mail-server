import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { PaginatedResult, PaginationQuery, resolveSortColumn } from "../../core/common/pagination.validation";
import { CustomPermissionGuardService } from "../../core/custom-permission-guard/custom-permission-guard.service";
import { Account } from "../../core/entities/account.entity";
import { AccountProfile } from "../../core/entities/account-profile.entity";
import { SupportTicket } from "../../core/entities/support-ticket.entity";
import { SupportTicketMessage } from "../../core/entities/support-ticket-message.entity";
import { SupportTicketRead } from "../../core/entities/support-ticket-read.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { NotificationsService } from "../../core/notifications/notifications.service";
import { TopicPresenceService } from "../../core/websocket/presence.service";
import { CreateTicketDto, ReplyTicketDto, TicketListQuery } from "./tickets.validation";

export const TICKET_SORTABLE_COLUMNS = ["subject", "status", "createdAt", "updatedAt"] as const;

// How many messages the thread carries by default, newest ones. Older pages are
// fetched on demand so a long ticket never ships whole, over REST or websocket.
export const MESSAGE_PAGE = 10;

interface TicketAuthor {
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface TicketCaller {
  userId: string;
  isRoot: boolean;
}

@Injectable()
export class TicketsService {
  private readonly log = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(SupportTicket) private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage) private readonly messages: Repository<SupportTicketMessage>,
    @InjectRepository(SupportTicketRead) private readonly reads: Repository<SupportTicketRead>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    private readonly cpg: CustomPermissionGuardService,
    private readonly notifications: NotificationsService,
    private readonly presence: TopicPresenceService
  ) {}

  // Identity shown next to a message: the display name when the account set
  // one, its avatar, and the email as the stable fallback label.
  private async authorsFor(ids: (string | null)[]): Promise<Map<string, TicketAuthor>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map();
    const [accounts, profiles] = await Promise.all([
      this.accounts.find({ where: { id: In(unique) }, select: { id: true, email: true } }),
      this.profiles.find({ where: { accountId: In(unique) }, select: { accountId: true, displayName: true, avatarUrl: true } }),
    ]);
    const profileById = new Map(profiles.map((p) => [p.accountId, p]));
    return new Map(
      accounts.map((a) => {
        const profile = profileById.get(a.id);
        return [a.id, { email: a.email, name: profile?.displayName || a.email, avatarUrl: profile?.avatarUrl ?? null }];
      })
    );
  }

  private async messageRows(ticketId: number, offset: number, limit: number) {
    const [rows, total] = await this.messages.findAndCount({
      where: { ticketId },
      order: { createdAt: "DESC", id: "DESC" },
      skip: offset,
      take: limit,
    });
    const authorById = await this.authorsFor(rows.map((m) => m.authorId));
    const items = rows.reverse().map((m) => {
      const author = m.authorId ? authorById.get(m.authorId) : undefined;
      return {
        ...m,
        authorEmail: author?.email ?? null,
        authorName: author?.name ?? null,
        authorAvatarUrl: author?.avatarUrl ?? null,
      };
    });
    return { items, total };
  }

  // Older pages of a long thread, newest-first on the wire, oldest-first inside
  // a page so the front can prepend a page without re-sorting.
  async messagesPage(id: number, caller: TicketCaller, query: PaginationQuery) {
    await this.visibleTicket(id, caller);
    const limit = query.limit ?? MESSAGE_PAGE;
    const { items, total } = await this.messageRows(id, query.offset, limit);
    return { items, total } satisfies PaginatedResult<unknown>;
  }

  private async domainNamesFor(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const rows = await this.domains.find({ where: { id: In(unique) }, select: { id: true, domain: true } });
    return new Map(rows.map((r) => [r.id, r.domain]));
  }

  private async isSupport(caller: TicketCaller): Promise<boolean> {
    if (caller.isRoot) return true;
    return this.cpg.guard.utils.check.global(caller.userId, "tickets", "handle-ticket");
  }

  async visibleDomainIds(caller: TicketCaller): Promise<number[] | null> {
    if (caller.isRoot) return null;
    const effective = await this.cpg.guard.getEffectivePermissions(caller.userId);
    if (effective.global.some((p) => p.resource === "domains" && p.action === "list-all-domains")) return null;
    const owned = await this.domains.find({ where: { ownerId: caller.userId }, select: { id: true } });
    return [...new Set([...effective.domain.map((p) => p.domainId), ...owned.map((d) => d.id)])];
  }

  // `tickets:notification` is the trigger: no action, no notification at all.
  private mayBeNotified(caller: TicketCaller): Promise<boolean> {
    if (caller.isRoot) return Promise.resolve(true);
    return this.cpg.guard.utils.check.global(caller.userId, "tickets", "notification");
  }

  // Until someone takes it in charge a ticket is everyone's business, so every
  // eligible account is reached. Once assigned it becomes a conversation
  // between its author and its handler, and the rest of the support stops
  // being notified of each message.
  private parties(ticket: SupportTicket): Set<string> | null {
    if (!ticket.assignedTo) return null;
    return new Set([ticket.createdBy, ticket.assignedTo].filter((id): id is string => !!id));
  }

  // Access to the domain and the ticket's own visibility stay mandatory on top,
  // so an account that could not open the ticket is never notified.
  private async notifiableAccounts(ticket: SupportTicket, actorId: string): Promise<string[]> {
    const parties = this.parties(ticket);
    const candidates = await this.accounts.find({ where: { enabled: 1 }, select: { id: true, isRoot: true } });
    const recipients: string[] = [];
    for (const account of candidates) {
      if (account.id === actorId) continue;
      if (parties && !parties.has(account.id)) continue;
      const caller: TicketCaller = { userId: account.id, isRoot: account.isRoot === 1 };
      if (!(await this.mayBeNotified(caller))) continue;
      const domainIds = await this.visibleDomainIds(caller);
      if (domainIds && !domainIds.includes(ticket.domainId)) continue;
      if (ticket.visibility !== "public" && ticket.createdBy !== account.id && !(await this.isSupport(caller))) continue;
      recipients.push(account.id);
    }
    return recipients;
  }

  // Anyone with the thread open is already watching it live, so notifying them
  // about a message they are reading is noise.
  private async notify(ticket: SupportTicket, type: string, actorId: string, extra: Record<string, unknown> = {}) {
    try {
      const watching = this.presence.watchers(`ticket:${ticket.id}`);
      const accountIds = (await this.notifiableAccounts(ticket, actorId)).filter((id) => !watching.has(id));
      if (!accountIds.length) return;
      const domainName = (await this.domainNamesFor([ticket.domainId])).get(ticket.domainId) ?? null;
      const actor = (await this.authorsFor([actorId])).get(actorId)?.name ?? null;
      const payload = { ticketId: ticket.id, subject: ticket.subject, domainName, actor, ...extra };
      const link = `/tickets/${ticket.id}`;
      await this.notifications.dispatch({
        accountIds,
        source: "support",
        type,
        payload,
        link,
      });
    } catch (e) {
      this.log.warn(`Ticket #${ticket.id} notification failed: ${(e as Error).message}`);
    }
  }

  async list(query: TicketListQuery, caller: TicketCaller) {
    const support = await this.isSupport(caller);
    const domainIds = await this.visibleDomainIds(caller);
    if (domainIds?.length === 0) {
      return query.limit === undefined ? [] : ({ items: [], total: 0 } satisfies PaginatedResult<unknown>);
    }

    const qb = this.tickets.createQueryBuilder("t");
    if (domainIds) qb.andWhere("t.domainId IN (:...domainIds)", { domainIds });
    if (!support) {
      qb.andWhere("(t.visibility = :public OR t.createdBy = :uid)", { public: "public", uid: caller.userId });
    }
    if (query.mine === "true") qb.andWhere("t.assignedTo = :me", { me: caller.userId });
    if (query.search) qb.andWhere("t.subject LIKE :search", { search: `%${query.search}%` });
    const sortBy = resolveSortColumn(query.sortBy, TICKET_SORTABLE_COLUMNS, "createdAt");
    qb.orderBy(`t.${sortBy}`, query.sortDir === "asc" ? "ASC" : "DESC");

    if (query.limit === undefined) return this.enrich(await qb.getMany(), caller.userId);
    const total = await qb.getCount();
    const items = await qb.skip(query.offset).take(query.limit).getMany();
    return { items: await this.enrich(items, caller.userId), total } satisfies PaginatedResult<unknown>;
  }

  // Author of the newest message of each ticket. Having written at some point
  // is not the question: what marks a ticket as waiting is that the last word
  // belongs to someone else.
  private async lastAuthorByTicket(ticketIds: number[]): Promise<Map<number, string | null>> {
    if (!ticketIds.length) return new Map();
    const rows = await this.messages
      .createQueryBuilder("m")
      .select("m.ticket_id", "ticketId")
      .addSelect("m.author_id", "authorId")
      .where(
        "m.id IN (SELECT MAX(x.id) FROM support_ticket_messages x WHERE x.ticket_id IN (:...ticketIds) GROUP BY x.ticket_id)",
        { ticketIds }
      )
      .getRawMany<{ ticketId: number | string; authorId: string | null }>();
    return new Map(rows.map((r) => [Number(r.ticketId), r.authorId]));
  }

  private async enrich(rows: SupportTicket[], callerId: string) {
    const authorById = await this.authorsFor([...rows.map((r) => r.assignedTo), ...rows.map((r) => r.createdBy)]);
    const domainById = await this.domainNamesFor(rows.map((r) => r.domainId));
    const lastAuthor = await this.lastAuthorByTicket(rows.map((r) => r.id));
    return rows.map((r) => {
      const assignee = r.assignedTo ? authorById.get(r.assignedTo) : undefined;
      const creator = r.createdBy ? authorById.get(r.createdBy) : undefined;
      return {
        ...r,
        assigneeEmail: assignee?.email ?? null,
        assigneeName: assignee?.name ?? null,
        creatorEmail: creator?.email ?? null,
        creatorName: creator?.name ?? null,
        creatorAvatarUrl: creator?.avatarUrl ?? null,
        domainName: domainById.get(r.domainId) ?? null,
        awaitingMyReply: lastAuthor.has(r.id) && lastAuthor.get(r.id) !== callerId,
      };
    });
  }

  private async visibleTicket(id: number, caller: TicketCaller): Promise<SupportTicket> {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket #${id} not found`);
    const domainIds = await this.visibleDomainIds(caller);
    if (domainIds && !domainIds.includes(ticket.domainId)) {
      throw new NotFoundException(`Ticket #${id} not found`);
    }
    const support = await this.isSupport(caller);
    if (!support && ticket.visibility !== "public" && ticket.createdBy !== caller.userId) {
      throw new NotFoundException(`Ticket #${id} not found`);
    }
    return ticket;
  }

  async get(id: number, caller: TicketCaller) {
    return this.detail(await this.visibleTicket(id, caller));
  }

  // The realtime thread: authorization already happened when the socket
  // subscribed, and every authorized subscriber sees the very same thread.
  async thread(id: number) {
    const ticket = await this.tickets.findOne({ where: { id } });
    return ticket ? this.detail(ticket) : null;
  }

  // Read receipts are per account and cumulative: only the id of the newest
  // message seen is kept, so a reader coming back never un-reads what they had
  // already seen.
  async markRead(id: number, caller: TicketCaller) {
    await this.visibleTicket(id, caller);
    const [newest] = await this.messages.find({ where: { ticketId: id }, order: { id: "DESC" }, take: 1 });
    const lastReadMessageId = newest?.id ?? 0;
    const existing = await this.reads.findOne({ where: { ticketId: id, accountId: caller.userId } });
    if (existing && existing.lastReadMessageId >= lastReadMessageId) return { lastReadMessageId };
    await this.reads.save(this.reads.create({ ticketId: id, accountId: caller.userId, lastReadMessageId }));
    return { lastReadMessageId };
  }

  private async readersOf(ticketId: number) {
    const rows = await this.reads.find({ where: { ticketId } });
    const authorById = await this.authorsFor(rows.map((r) => r.accountId));
    return rows.map((r) => ({
      accountId: r.accountId,
      name: authorById.get(r.accountId)?.name ?? null,
      avatarUrl: authorById.get(r.accountId)?.avatarUrl ?? null,
      lastReadMessageId: r.lastReadMessageId,
      readAt: r.readAt,
    }));
  }

  async canWatch(id: number, caller: TicketCaller): Promise<boolean> {
    try {
      if (!caller.isRoot) {
        await this.cpg.guard.assertOne.global(caller.userId, "tickets", { acrud: ["access", "view-ticket"] });
      }
      await this.visibleTicket(id, caller);
      return true;
    } catch {
      return false;
    }
  }

  private async detail(ticket: SupportTicket) {
    const id = ticket.id;
    const { items, total } = await this.messageRows(id, 0, MESSAGE_PAGE);
    const authorById = await this.authorsFor([ticket.createdBy, ticket.assignedTo]);
    const domainById = await this.domainNamesFor([ticket.domainId]);
    const creator = ticket.createdBy ? authorById.get(ticket.createdBy) : undefined;
    const assignee = ticket.assignedTo ? authorById.get(ticket.assignedTo) : undefined;
    return {
      ...ticket,
      domainName: domainById.get(ticket.domainId) ?? null,
      creatorEmail: creator?.email ?? null,
      creatorName: creator?.name ?? null,
      creatorAvatarUrl: creator?.avatarUrl ?? null,
      assigneeEmail: assignee?.email ?? null,
      assigneeName: assignee?.name ?? null,
      assigneeAvatarUrl: assignee?.avatarUrl ?? null,
      messages: items,
      messagesTotal: total,
      readers: await this.readersOf(id),
    };
  }

  async create(input: CreateTicketDto, caller: TicketCaller) {
    const domain = await this.domains.findOne({ where: { id: input.domainId } });
    if (!domain) throw new NotFoundException(`Domain #${input.domainId} not found`);
    const domainIds = await this.visibleDomainIds(caller);
    if (domainIds && !domainIds.includes(input.domainId)) {
      throw new ForbiddenException("You cannot open a ticket about a domain you have no access to");
    }
    const ticket = await this.tickets.save(
      this.tickets.create({
        domainId: input.domainId,
        createdBy: caller.userId,
        subject: input.subject,
        visibility: input.visibility ?? "private",
        status: "open",
      })
    );
    await this.messages.save(this.messages.create({ ticketId: ticket.id, authorId: caller.userId, body: input.body }));
    await this.notify(ticket, "ticket-created", caller.userId);
    return ticket;
  }

  // Answering one's own ticket is not a privilege: the author always replies to
  // their own thread. `reply-ticket` gates answering *someone else's* ticket,
  // which is the support side of the exchange. A closed ticket takes no more
  // messages, whoever asks.
  async reply(id: number, input: ReplyTicketDto, caller: TicketCaller) {
    const ticket = await this.visibleTicket(id, caller);
    if (ticket.status === "closed") {
      throw new ForbiddenException("This ticket is closed and takes no further message");
    }
    if (ticket.createdBy !== caller.userId && !caller.isRoot) {
      const allowed = await this.cpg.guard.utils.check.global(caller.userId, "tickets", "reply-ticket");
      if (!allowed) throw new ForbiddenException("You may only reply to a ticket you opened");
    }
    const message = await this.messages.save(this.messages.create({ ticketId: id, authorId: caller.userId, body: input.body }));
    await this.tickets
      .createQueryBuilder()
      .update()
      .set({ updatedAt: () => "CURRENT_TIMESTAMP" })
      .where("id = :id", { id })
      .execute();
    await this.notify(ticket, "ticket-replied", caller.userId);
    return message;
  }

  async take(id: number, caller: TicketCaller) {
    const ticket = await this.visibleTicket(id, caller);
    if (ticket.createdBy === caller.userId) {
      throw new ForbiddenException("You cannot take charge of a ticket you opened");
    }
    ticket.assignedTo = caller.userId;
    if (ticket.status === "open") ticket.status = "in_progress";
    const saved = await this.tickets.save(ticket);
    await this.notify(saved, "ticket-taken", caller.userId);
    return saved;
  }

  // Driving a ticket through its statuses is the support role's job, with one
  // exception: the author may always close their own ticket, because giving up
  // on one's own request needs nobody's permission. Reopening it does.
  async setStatus(id: number, status: string, caller: TicketCaller) {
    const ticket = await this.visibleTicket(id, caller);
    const isAuthorClosing = ticket.createdBy === caller.userId && status === "closed";
    if (!isAuthorClosing && !(await this.isSupport(caller))) {
      throw new ForbiddenException("You may only close a ticket you opened");
    }
    ticket.status = status;
    const saved = await this.tickets.save(ticket);
    await this.notify(saved, "ticket-status", caller.userId, { status });
    return saved;
  }
}
