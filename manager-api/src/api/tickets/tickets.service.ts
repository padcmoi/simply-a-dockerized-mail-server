import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { PaginatedResult, PaginationQuery, resolveSortColumn } from "../../core/common/pagination.validation";
import { CustomPermissionGuardService } from "../../core/custom-permission-guard/custom-permission-guard.service";
import { Account } from "../../core/entities/account.entity";
import { AccountProfile, composeDisplayName } from "../../core/entities/account-profile.entity";
import { SupportTicket } from "../../core/entities/support-ticket.entity";
import { SupportTicketMessage } from "../../core/entities/support-ticket-message.entity";
import { SupportTicketRead } from "../../core/entities/support-ticket-read.entity";
import { SupportTicketRecipient } from "../../core/entities/support-ticket-recipient.entity";
import { SupportTicketAlias } from "../../core/entities/support-ticket-alias.entity";
import { DomainDelegation } from "../../core/entities/domain-delegation.entity";
import { VirtualAlias } from "../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { NotificationsService } from "../../core/notifications/notifications.service";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import { TopicPresenceService } from "../../core/websocket/presence.service";
import { CreateTicketDto, ReplyTicketDto, TicketListQuery } from "./tickets.validation";
import { ActivityLogService } from "../../core/activity/activity-log.service";

export const TICKET_SORTABLE_COLUMNS = ["subject", "status", "createdAt", "updatedAt"] as const;

// How many messages the thread carries by default, newest ones. Older pages are
// fetched on demand so a long ticket never ships whole, over REST or websocket.
export const MESSAGE_PAGE = 10;

// The author may edit a message for one hour after writing it, then it is fixed.
export const TICKET_MESSAGE_EDIT_WINDOW_MS = 60 * 60 * 1000;

interface TicketAuthor {
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface TicketCaller {
  userId: string;
  isRoot: boolean;
}

export interface TicketableResources {
  required: boolean;
  recipients: { id: number; email: string }[];
  aliases: { id: number; source: string; destination: string }[];
}

@Injectable()
export class TicketsService {
  private readonly log = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(SupportTicket) private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage) private readonly messages: Repository<SupportTicketMessage>,
    @InjectRepository(SupportTicketRead) private readonly reads: Repository<SupportTicketRead>,
    @InjectRepository(SupportTicketRecipient) private readonly ticketRecipients: Repository<SupportTicketRecipient>,
    @InjectRepository(SupportTicketAlias) private readonly ticketAliases: Repository<SupportTicketAlias>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser) private readonly recipients: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly aliases: Repository<VirtualAlias>,
    @InjectRepository(DomainDelegation) private readonly delegations: Repository<DomainDelegation>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(AccountProfile) private readonly profiles: Repository<AccountProfile>,
    private readonly cpg: CustomPermissionGuardService,
    private readonly notifications: NotificationsService,
    private readonly presence: TopicPresenceService,
    private readonly appSettings: AppSettingsService,
    private readonly activity: ActivityLogService
  ) {}

  // Identity shown next to a message: the display name when the account set
  // one, its avatar, and the email as the stable fallback label.
  private async authorsFor(ids: (string | null)[]): Promise<Map<string, TicketAuthor>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map();
    const [accounts, profiles] = await Promise.all([
      this.accounts.find({ where: { id: In(unique) }, select: { id: true, email: true } }),
      this.profiles.find({
        where: { accountId: In(unique) },
        select: { accountId: true, firstName: true, lastName: true, avatarUrl: true },
      }),
    ]);
    const profileById = new Map(profiles.map((p) => [p.accountId, p]));
    return new Map(
      accounts.map((a) => {
        const profile = profileById.get(a.id);
        return [
          a.id,
          {
            email: a.email,
            name: composeDisplayName(profile?.firstName, profile?.lastName) || a.email,
            avatarUrl: profile?.avatarUrl ?? null,
          },
        ];
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

  // Who reaches a PRIVATE ticket they did not open: root and the support role
  // (handle-ticket) alone. reply-ticket deliberately does NOT open privates:
  // it lets one answer someone else's PUBLIC thread, nothing more. The
  // ticket's domain owner is checked per ticket in canSeePrivate.
  private privateReach(caller: TicketCaller): Promise<boolean> {
    return this.isSupport(caller);
  }

  private async canSeePrivate(caller: TicketCaller, ticket: SupportTicket): Promise<boolean> {
    if (ticket.createdBy === caller.userId) return true;
    if (await this.privateReach(caller)) return true;
    return (await this.domains.count({ where: { id: ticket.domainId, ownerId: caller.userId } })) > 0;
  }

  // A foothold on a domain opens its support desk too: owning a mailbox or an
  // alias there, or holding a delegation, counts like a domain permission even
  // without owning the domain. The global tickets ACL stays the gate in front.
  async visibleDomainIds(caller: TicketCaller): Promise<number[] | null> {
    if (caller.isRoot) return null;
    const effective = await this.cpg.guard.getEffectivePermissions(caller.userId);
    if (effective.global.some((p) => p.resource === "domains" && p.action === "list-all-domains")) return null;
    const owned = await this.domains.find({ where: { ownerId: caller.userId }, select: { id: true } });
    const delegated = await this.delegations.find({ where: { accountId: caller.userId }, select: { domainId: true } });
    const ownedRecipients = await this.recipients.find({ where: { ownerId: caller.userId }, select: { domain: true } });
    const ownedAliases = await this.aliases.find({ where: { ownerId: caller.userId }, select: { domain: true } });
    const fqdns = [...new Set([...ownedRecipients.map((r) => r.domain), ...ownedAliases.map((a) => a.domain)])];
    const footholds = fqdns.length ? await this.domains.find({ where: { domain: In(fqdns) }, select: { id: true } }) : [];
    return [
      ...new Set([
        ...effective.domain.map((p) => p.domainId),
        ...owned.map((d) => d.id),
        ...delegated.map((d) => d.domainId),
        ...footholds.map((d) => d.id),
      ]),
    ];
  }

  // The domains the caller may open a ticket about, resolved to names for the
  // creation form's selector. Null from visibleDomainIds = every domain.
  async ticketableDomains(caller: TicketCaller) {
    const ids = await this.visibleDomainIds(caller);
    const rows =
      ids === null
        ? await this.domains.find({ select: { id: true, domain: true }, order: { domain: "ASC" } })
        : ids.length
          ? await this.domains.find({ where: { id: In(ids) }, select: { id: true, domain: true }, order: { domain: "ASC" } })
          : [];
    return rows.map((d) => ({ id: d.id, domain: d.domain }));
  }

  // Whether the caller may name every address of a domain, or only its own.
  // Root and the domain's owner read all of it; anyone else needs the very
  // right that lists that kind of address there. A permission on another corner
  // of the domain (DKIM, quotas, supervision) is not a right over its mailboxes
  // and widens nothing, and `domains:list-all-domains` lists domains, not the
  // addresses inside them. Everything else is offered what it owns, which is
  // already all it can see anywhere else in the interface.
  private async readsEveryAddress(caller: TicketCaller, domain: VirtualDomain, resource: "recipients" | "aliases") {
    if (caller.isRoot) return true;
    if (domain.ownerId === caller.userId) return true;
    const action = resource === "recipients" ? "list-recipients" : "list-aliases";
    const effective = await this.cpg.guard.getEffectivePermissions(caller.userId);
    return effective.domain.some((p) => p.domainId === domain.id && p.resource === resource && p.action === action);
  }

  // The addresses of one domain a ticket may name, plus whether naming one is
  // mandatory. One call feeds both selectors of the creation form and tells it
  // how to gate its own submit, so the front never guesses the server's rule.
  async ticketableResources(domainId: number, caller: TicketCaller): Promise<TicketableResources> {
    const domain = await this.domains.findOne({ where: { id: domainId } });
    if (!domain) throw new NotFoundException(`Domain #${domainId} not found`);
    const domainIds = await this.visibleDomainIds(caller);
    if (domainIds && !domainIds.includes(domainId)) {
      throw new NotFoundException(`Domain #${domainId} not found`);
    }
    const [everyRecipient, everyAlias] = await Promise.all([
      this.readsEveryAddress(caller, domain, "recipients"),
      this.readsEveryAddress(caller, domain, "aliases"),
    ]);
    const [recipients, aliases] = await Promise.all([
      this.recipients.find({
        where: { domain: domain.domain, ...(everyRecipient ? {} : { ownerId: caller.userId }) },
        select: { id: true, email: true },
        order: { email: "ASC" },
      }),
      this.aliases.find({
        where: { domain: domain.domain, ...(everyAlias ? {} : { ownerId: caller.userId }) },
        select: { id: true, source: true, destination: true },
        order: { source: "ASC" },
      }),
    ]);
    return {
      required: this.appSettings.get().ticketResourcesRequired,
      recipients: recipients.map((r) => ({ id: r.id, email: r.email })),
      aliases: aliases.map((a) => ({ id: a.id, source: a.source, destination: a.destination })),
    };
  }

  // A ticket may only name addresses of its own domain that its author was
  // actually offered, so a hand-written payload cannot attach someone else's
  // mailbox or an address of another domain.
  private assertNamedResources(offered: TicketableResources, recipientIds: number[], aliasIds: number[]) {
    const knownRecipients = new Set(offered.recipients.map((r) => r.id));
    const knownAliases = new Set(offered.aliases.map((a) => a.id));
    if (recipientIds.some((id) => !knownRecipients.has(id))) {
      throw new BadRequestException("A named mailbox does not belong to this domain, or is not yours to name");
    }
    if (aliasIds.some((id) => !knownAliases.has(id))) {
      throw new BadRequestException("A named alias does not belong to this domain, or is not yours to name");
    }
  }

  // The named addresses of a batch of tickets, resolved to what they read as.
  // Four queries for a whole page rather than four per ticket, so the list
  // costs what the detail of one costs. Nothing filters out a deleted address:
  // the foreign keys took its rows with it when it went.
  private async namedResourcesFor(rows: SupportTicket[]) {
    const ticketIds = rows.map((r) => r.id);
    if (!ticketIds.length) return () => ({ recipients: [], aliases: [] });

    const [recipientLinks, aliasLinks] = await Promise.all([
      this.ticketRecipients.find({ where: { ticketId: In(ticketIds) } }),
      this.ticketAliases.find({ where: { ticketId: In(ticketIds) } }),
    ]);
    const recipientIds = [...new Set(recipientLinks.map((l) => l.recipientId))];
    const aliasIds = [...new Set(aliasLinks.map((l) => l.aliasId))];
    const [recipients, aliases] = await Promise.all([
      recipientIds.length
        ? this.recipients.find({ where: { id: In(recipientIds) }, select: { id: true, email: true }, order: { email: "ASC" } })
        : Promise.resolve([]),
      aliasIds.length
        ? this.aliases.find({
            where: { id: In(aliasIds) },
            select: { id: true, source: true, destination: true },
            order: { source: "ASC" },
          })
        : Promise.resolve([]),
    ]);
    const recipientById = new Map(recipients.map((r) => [r.id, { id: r.id, email: r.email }]));
    const aliasById = new Map(aliases.map((a) => [a.id, { id: a.id, source: a.source, destination: a.destination }]));

    const recipientsByTicket = new Map<number, { id: number; email: string }[]>();
    for (const link of recipientLinks) {
      const resolved = recipientById.get(link.recipientId);
      if (!resolved) continue;
      const list = recipientsByTicket.get(link.ticketId) ?? [];
      list.push(resolved);
      recipientsByTicket.set(link.ticketId, list);
    }
    const aliasesByTicket = new Map<number, { id: number; source: string; destination: string }[]>();
    for (const link of aliasLinks) {
      const resolved = aliasById.get(link.aliasId);
      if (!resolved) continue;
      const list = aliasesByTicket.get(link.ticketId) ?? [];
      list.push(resolved);
      aliasesByTicket.set(link.ticketId, list);
    }

    return (ticket: SupportTicket) => ({
      recipients: recipientsByTicket.get(ticket.id) ?? [],
      aliases: aliasesByTicket.get(ticket.id) ?? [],
    });
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
      if (ticket.visibility !== "public" && !(await this.canSeePrivate(caller, ticket))) continue;
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
      const link = `/admin/tickets/${ticket.id}`;
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
    const reach = await this.privateReach(caller);
    const domainIds = await this.visibleDomainIds(caller);
    if (domainIds?.length === 0) {
      return query.limit === undefined ? [] : ({ items: [], total: 0 } satisfies PaginatedResult<unknown>);
    }

    const qb = this.tickets.createQueryBuilder("t");
    if (domainIds) qb.andWhere("t.domainId IN (:...domainIds)", { domainIds });
    if (!reach) {
      const owned = await this.domains.find({ where: { ownerId: caller.userId }, select: { id: true } });
      if (owned.length) {
        qb.andWhere("(t.visibility = :public OR t.createdBy = :uid OR t.domainId IN (:...ownedDomainIds))", {
          public: "public",
          uid: caller.userId,
          ownedDomainIds: owned.map((d) => d.id),
        });
      } else {
        qb.andWhere("(t.visibility = :public OR t.createdBy = :uid)", { public: "public", uid: caller.userId });
      }
    }
    if (query.mine === "true") qb.andWhere("t.assignedTo = :me", { me: caller.userId });
    if (query.hideClosed === "true") qb.andWhere("t.status != :closedStatus", { closedStatus: "closed" });
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
    const named = await this.namedResourcesFor(rows);
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
        ...named(r),
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
    if (ticket.visibility !== "public" && !(await this.canSeePrivate(caller, ticket))) {
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
      ...(await this.namedResourcesFor([ticket]))(ticket),
    };
  }

  async create(input: CreateTicketDto, caller: TicketCaller) {
    const domain = await this.domains.findOne({ where: { id: input.domainId } });
    if (!domain) throw new NotFoundException(`Domain #${input.domainId} not found`);
    const domainIds = await this.visibleDomainIds(caller);
    if (domainIds && !domainIds.includes(input.domainId)) {
      throw new ForbiddenException("You cannot open a ticket about a domain you have no access to");
    }
    const recipientIds = [...new Set(input.recipientIds ?? [])];
    const aliasIds = [...new Set(input.aliasIds ?? [])];
    const offered = await this.ticketableResources(domain.id, caller);
    const namesSomething = recipientIds.length > 0 || aliasIds.length > 0;
    const hasSomethingToName = offered.recipients.length > 0 || offered.aliases.length > 0;
    // A domain with no address at all cannot satisfy the rule, so the rule does
    // not apply to it: refusing every ticket on an empty domain would lock the
    // support desk out of the very domain that is being set up.
    if (offered.required && hasSomethingToName && !namesSomething) {
      throw new BadRequestException("This server asks a ticket to name at least one mailbox or alias of its domain");
    }
    this.assertNamedResources(offered, recipientIds, aliasIds);
    const ticket = await this.tickets.save(
      this.tickets.create({
        domainId: input.domainId,
        createdBy: caller.userId,
        subject: input.subject,
        visibility: input.visibility ?? "private",
        status: "open",
      })
    );
    if (recipientIds.length) {
      await this.ticketRecipients.save(recipientIds.map((recipientId) => ({ ticketId: ticket.id, recipientId })));
    }
    if (aliasIds.length) {
      await this.ticketAliases.save(aliasIds.map((aliasId) => ({ ticketId: ticket.id, aliasId })));
    }
    await this.messages.save(this.messages.create({ ticketId: ticket.id, authorId: caller.userId, body: input.body }));
    await this.notify(ticket, "ticket-created", caller.userId);
    await this.activity.record({
      action: "tickets.created",
      actorId: caller.userId,
      entity: { type: "ticket", id: ticket.id, label: ticket.subject },
    });
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
    await this.activity.record({
      action: "tickets.replied",
      actorId: caller.userId,
      entity: { type: "ticket", id: ticket.id, label: ticket.subject },
    });
    return message;
  }

  // A message may be reworded by its own author, and only within an hour of
  // writing it: past that it is part of the record. Root is not the author, so
  // it does not get to edit someone else's words. Each edit bumps edit_count and
  // stamps updated_at, which the thread surfaces as an "edited" mark.
  async editMessage(ticketId: number, messageId: number, body: string, caller: TicketCaller) {
    const ticket = await this.visibleTicket(ticketId, caller);
    if (ticket.status === "closed") {
      throw new ForbiddenException("This ticket is closed and its messages can no longer be edited");
    }
    const message = await this.messages.findOne({ where: { id: messageId, ticketId } });
    if (!message) throw new NotFoundException(`Message #${messageId} not found`);
    if (message.authorId !== caller.userId) {
      throw new ForbiddenException("You may only edit your own message");
    }
    if (Date.now() - message.createdAt.getTime() > TICKET_MESSAGE_EDIT_WINDOW_MS) {
      throw new ForbiddenException("This message is older than an hour and can no longer be edited");
    }
    message.body = body;
    message.updatedAt = new Date();
    message.editCount += 1;
    const saved = await this.messages.save(message);
    await this.activity.record({
      action: "tickets.message-edited",
      actorId: caller.userId,
      entity: { type: "ticket", id: ticketId },
    });
    return saved;
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
    await this.activity.record({
      action: "tickets.taken",
      actorId: caller.userId,
      entity: { type: "ticket", id: saved.id, label: saved.subject },
    });
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
    await this.activity.record({
      action: "tickets.status-changed",
      actorId: caller.userId,
      entity: { type: "ticket", id: saved.id, label: saved.subject },
      details: { status },
    });
    return saved;
  }
}
