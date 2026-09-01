import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { MESSAGE_PAGE, TicketsService, type TicketCaller } from "../../src/api/tickets/tickets.service";
import type { NotificationsService } from "../../src/core/notifications/notifications.service";
import { APP_SETTINGS_DEFAULTS, type AppSettingsService } from "../../src/core/settings/app-settings.service";
import { TopicPresenceService } from "../../src/core/websocket/presence.service";
import type { Account } from "../../src/core/entities/account.entity";
import type { AccountProfile } from "../../src/core/entities/account-profile.entity";
import type { SupportTicket } from "../../src/core/entities/support-ticket.entity";
import type { SupportTicketMessage } from "../../src/core/entities/support-ticket-message.entity";
import type { SupportTicketRead } from "../../src/core/entities/support-ticket-read.entity";
import type { SupportTicketRecipient } from "../../src/core/entities/support-ticket-recipient.entity";
import type { SupportTicketAlias } from "../../src/core/entities/support-ticket-alias.entity";
import type { DomainDelegation } from "../../src/core/entities/domain-delegation.entity";
import type { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import type { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import type { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { cpgMock, entity, providerMock, qbMock, repoMock, type CpgMock, type Loose } from "../helpers/mocks";

const DOMAIN_ID = 12;
const SUPPORT = "support-id";
const CREATOR = "creator-id";
const STRANGER = "stranger-id";
const ROOT_ID = "root-id";

describe("TicketsService (row-level visibility)", () => {
  let tickets: ReturnType<typeof repoMock<SupportTicket>>;
  let messages: ReturnType<typeof repoMock<SupportTicketMessage>>;
  let reads: ReturnType<typeof repoMock<SupportTicketRead>>;
  let ticketRecipients: ReturnType<typeof repoMock<SupportTicketRecipient>>;
  let ticketAliases: ReturnType<typeof repoMock<SupportTicketAlias>>;
  let domains: ReturnType<typeof repoMock<VirtualDomain>>;
  let recipients: ReturnType<typeof repoMock<VirtualUser>>;
  let aliases: ReturnType<typeof repoMock<VirtualAlias>>;
  let delegations: ReturnType<typeof repoMock<DomainDelegation>>;
  let accounts: ReturnType<typeof repoMock<Account>>;
  let profiles: ReturnType<typeof repoMock<AccountProfile>>;
  let cpg: CpgMock;
  let notifications: Loose<NotificationsService>;
  let appSettings: Loose<AppSettingsService>;
  let presence: TopicPresenceService;
  let svc: TicketsService;

  beforeEach(() => {
    tickets = repoMock<SupportTicket>();
    messages = repoMock<SupportTicketMessage>();
    reads = repoMock<SupportTicketRead>();
    reads.find.mockResolvedValue([]);
    reads.findOne.mockResolvedValue(null);
    ticketRecipients = repoMock<SupportTicketRecipient>();
    ticketAliases = repoMock<SupportTicketAlias>();
    ticketRecipients.find.mockResolvedValue([]);
    ticketAliases.find.mockResolvedValue([]);
    domains = repoMock<VirtualDomain>();
    recipients = repoMock<VirtualUser>();
    aliases = repoMock<VirtualAlias>();
    delegations = repoMock<DomainDelegation>();
    recipients.find.mockResolvedValue([]);
    aliases.find.mockResolvedValue([]);
    delegations.find.mockResolvedValue([]);
    accounts = repoMock<Account>();
    profiles = repoMock<AccountProfile>();
    profiles.find.mockResolvedValue([]);
    messages.findAndCount.mockResolvedValue([[], 0]);
    // enrich() asks which tickets the caller already answered on every list.
    const repliedQb = qbMock<SupportTicketMessage>();
    repliedQb.getRawMany.mockResolvedValue([]);
    messages.createQueryBuilder.mockReturnValue(repliedQb);
    accounts.find.mockResolvedValue([]);
    domains.find.mockResolvedValue([]);
    domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: DOMAIN_ID, domain: "example.com" }));
    cpg = cpgMock();
    cpg.guard.utils.check.global.mockResolvedValue(false);
    cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [{ domainId: DOMAIN_ID }] });
    notifications = providerMock<NotificationsService>({ dispatch: vi.fn().mockResolvedValue(undefined) });
    // These cases are about visibility, domain access and notifications, not
    // about naming a mailbox, so the server-wide requirement is off here.
    appSettings = providerMock<AppSettingsService>({
      get: vi.fn().mockReturnValue({ ...APP_SETTINGS_DEFAULTS, ticketResourcesRequired: false }),
    });
    presence = new TopicPresenceService();
    svc = new TicketsService(
      tickets,
      messages,
      reads,
      ticketRecipients,
      ticketAliases,
      domains,
      recipients,
      aliases,
      delegations,
      accounts,
      profiles,
      cpg,
      notifications,
      presence,
      appSettings
    );
  });

  const caller = (userId: string, isRoot = false): TicketCaller => ({ userId, isRoot });

  function updateQb() {
    const qb = qbMock<SupportTicket>();
    qb.execute.mockResolvedValue({});
    return qb;
  }

  function ticketRow(over: Partial<SupportTicket>): SupportTicket {
    return entity<SupportTicket>({
      id: 5,
      domainId: DOMAIN_ID,
      visibility: "private",
      createdBy: CREATOR,
      status: "open",
      ...over,
    });
  }

  describe("get / visibility", () => {
    beforeEach(() => messages.findAndCount.mockResolvedValue([[], 0]));

    it("hides a private ticket from a stranger (404, not 403)", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      await expect(svc.get(5, caller(STRANGER))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("shows a private ticket to its creator", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      await expect(svc.get(5, caller(CREATOR))).resolves.toMatchObject({ id: 5 });
    });

    it("shows a public ticket to anyone", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public", createdBy: CREATOR }));
      await expect(svc.get(5, caller(STRANGER))).resolves.toMatchObject({ id: 5 });
    });

    it("shows a private ticket to the support role (global handle-ticket)", async () => {
      cpg.guard.utils.check.global.mockResolvedValue(true);
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private" }));
      await expect(svc.get(5, caller(SUPPORT))).resolves.toMatchObject({ id: 5 });
      expect(cpg.guard.utils.check.global).toHaveBeenCalledWith(SUPPORT, "tickets", "handle-ticket");
    });

    it("keeps a private ticket hidden from a reply-ticket holder (that right covers public threads only)", async () => {
      cpg.guard.utils.check.global.mockImplementation(
        async (_u: string, _r: string, action: string) => action === "reply-ticket"
      );
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      await expect(svc.get(5, caller(STRANGER))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("shows a private ticket to a handle-ticket holder", async () => {
      cpg.guard.utils.check.global.mockImplementation(
        async (_u: string, _r: string, action: string) => action === "handle-ticket"
      );
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      await expect(svc.get(5, caller(STRANGER))).resolves.toMatchObject({ id: 5 });
    });

    it("shows a private ticket to the owner of its domain", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private" }));
      domains.count.mockResolvedValue(1);
      await expect(svc.get(5, caller(STRANGER))).resolves.toMatchObject({ id: 5 });
      expect(domains.count).toHaveBeenCalledWith({ where: { id: DOMAIN_ID, ownerId: STRANGER } });
    });

    it("still hides a private ticket from a mere foothold (no right, no ownership)", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      delegations.find.mockResolvedValue([entity<DomainDelegation>({ domainId: DOMAIN_ID })]);
      domains.count.mockResolvedValue(0);
      await expect(svc.get(5, caller(STRANGER))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lists an owned domain's private tickets through a dedicated clause", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [{ domainId: DOMAIN_ID }] });
      domains.find.mockResolvedValue([entity<VirtualDomain>({ id: DOMAIN_ID })]);
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      await svc.list({ offset: 0, sortDir: "desc" }, caller(STRANGER));
      const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(clauses.some((c) => c.includes("ownedDomainIds"))).toBe(true);
    });

    it("shows any ticket to root without consulting the guard", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private" }));
      await expect(svc.get(5, caller("root-id", true))).resolves.toMatchObject({ id: 5 });
      expect(cpg.guard.utils.check.global).not.toHaveBeenCalled();
    });

    it("404s an unknown ticket id", async () => {
      tickets.findOne.mockResolvedValue(null);
      await expect(svc.get(999, caller("root-id", true))).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("list / visibility filter", () => {
    it("restricts a non-support caller to public + own tickets", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      await svc.list({ offset: 0, sortDir: "desc" }, caller(STRANGER));
      const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(clauses.some((c) => c.includes("visibility") && c.includes("createdBy"))).toBe(true);
    });

    it("shows the support role every ticket (no visibility clause)", async () => {
      cpg.guard.utils.check.global.mockResolvedValue(true);
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      await svc.list({ offset: 0, sortDir: "desc" }, caller(SUPPORT));
      const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(clauses.some((c) => c.includes("visibility"))).toBe(false);
    });
  });

  describe("create", () => {
    it("stamps the caller as creator, defaults to private/open, and posts the first message", async () => {
      tickets.save.mockImplementation(async (t) => ({ ...(t as object), id: 1 }) as SupportTicket);
      messages.save.mockResolvedValue(entity<SupportTicketMessage>({ id: 1 }));
      const created = await svc.create({ domainId: DOMAIN_ID, subject: "Help", body: "broke" }, caller(CREATOR));
      expect(created).toMatchObject({ id: 1 });
      expect(tickets.create).toHaveBeenCalledWith(
        expect.objectContaining({
          domainId: DOMAIN_ID,
          createdBy: CREATOR,
          subject: "Help",
          visibility: "private",
          status: "open",
        })
      );
      expect(messages.create).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 1, authorId: CREATOR, body: "broke" }));
    });

    it("404s when the domain does not exist", async () => {
      domains.findOne.mockResolvedValue(null);
      await expect(svc.create({ domainId: 999, subject: "a", body: "b" }, caller(CREATOR))).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe("naming the mailboxes and aliases a ticket is about", () => {
    const MAILBOX = entity<VirtualUser>({ id: 3, email: "sales@example.com", domain: "example.com" });
    const ALIAS = entity<VirtualAlias>({ id: 7, source: "info@example.com", destination: "sales@example.com" });

    function offers(mailboxes: VirtualUser[], theAliases: VirtualAlias[]) {
      recipients.find.mockResolvedValue(mailboxes);
      aliases.find.mockResolvedValue(theAliases);
    }

    // What the domain's owner is offered: every address of the domain, which is
    // what the create cases below name.
    function asDomainOwner() {
      domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: DOMAIN_ID, domain: "example.com", ownerId: CREATOR }));
    }

    function acceptsSave() {
      tickets.save.mockImplementation(async (t) => ({ ...(t as object), id: 1 }) as SupportTicket);
      messages.save.mockResolvedValue(entity<SupportTicketMessage>({ id: 1 }));
    }

    describe("ticketableResources", () => {
      // Reaching the domain is not reading its addresses: the domain permission
      // that puts a ticket within reach here is `domain:access`, which widens
      // nothing. The caller is offered its own mailbox and nothing else.
      it("offers only what the caller owns when they merely reach the domain", async () => {
        offers([MAILBOX], [ALIAS]);
        await svc.ticketableResources(DOMAIN_ID, caller(CREATOR));
        expect(recipients.find).toHaveBeenCalledWith(
          expect.objectContaining({ where: { domain: "example.com", ownerId: CREATOR } })
        );
        expect(aliases.find).toHaveBeenCalledWith(
          expect.objectContaining({ where: { domain: "example.com", ownerId: CREATOR } })
        );
      });

      it("offers the whole domain to its owner", async () => {
        domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: DOMAIN_ID, domain: "example.com", ownerId: CREATOR }));
        offers([MAILBOX], [ALIAS]);
        const res = await svc.ticketableResources(DOMAIN_ID, caller(CREATOR));
        expect(res.recipients).toEqual([{ id: 3, email: "sales@example.com" }]);
        expect(res.aliases).toEqual([{ id: 7, source: "info@example.com", destination: "sales@example.com" }]);
        expect(recipients.find).toHaveBeenCalledWith(expect.objectContaining({ where: { domain: "example.com" } }));
      });

      // The right that lists that very kind of address, and nothing looser: a
      // permission over the domain's DKIM is not a right over its mailboxes.
      it("widens each kind only on the right that lists it", async () => {
        cpg.guard.getEffectivePermissions.mockResolvedValue({
          global: [],
          domain: [
            { domainId: DOMAIN_ID, resource: "recipients", action: "list-recipients" },
            { domainId: DOMAIN_ID, resource: "dkim", action: "view-dkim" },
          ],
        });
        offers([MAILBOX], [ALIAS]);
        await svc.ticketableResources(DOMAIN_ID, caller(CREATOR));
        expect(recipients.find).toHaveBeenCalledWith(expect.objectContaining({ where: { domain: "example.com" } }));
        expect(aliases.find).toHaveBeenCalledWith(
          expect.objectContaining({ where: { domain: "example.com", ownerId: CREATOR } })
        );
      });

      it("offers the whole domain to root", async () => {
        offers([MAILBOX], [ALIAS]);
        await svc.ticketableResources(DOMAIN_ID, caller(SUPPORT, true));
        expect(recipients.find).toHaveBeenCalledWith(expect.objectContaining({ where: { domain: "example.com" } }));
      });

      it("mirrors the server setting so the form gates on the same rule", async () => {
        offers([], []);
        appSettings.get.mockReturnValue({ ...APP_SETTINGS_DEFAULTS, ticketResourcesRequired: true });
        expect((await svc.ticketableResources(DOMAIN_ID, caller(CREATOR))).required).toBe(true);
      });

      it("404s on a domain that does not exist", async () => {
        domains.findOne.mockResolvedValue(null);
        await expect(svc.ticketableResources(999, caller(CREATOR))).rejects.toBeInstanceOf(NotFoundException);
      });

      // 404 and not 403, like every other ticket route: a domain out of reach is
      // not announced as existing.
      it("404s on a domain the caller cannot reach", async () => {
        cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [] });
        domains.find.mockResolvedValue([]);
        await expect(svc.ticketableResources(DOMAIN_ID, caller(STRANGER))).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe("create", () => {
      it("refuses a ticket that names nothing while the server asks for one", async () => {
        appSettings.get.mockReturnValue({ ...APP_SETTINGS_DEFAULTS, ticketResourcesRequired: true });
        asDomainOwner();
        offers([MAILBOX], []);
        await expect(svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b" }, caller(CREATOR))).rejects.toBeInstanceOf(
          BadRequestException
        );
      });

      it("links the named addresses in the pivot tables", async () => {
        asDomainOwner();
        offers([MAILBOX], [ALIAS]);
        acceptsSave();
        await svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b", recipientIds: [3], aliasIds: [7] }, caller(CREATOR));
        expect(ticketRecipients.save).toHaveBeenCalledWith([{ ticketId: 1, recipientId: 3 }]);
        expect(ticketAliases.save).toHaveBeenCalledWith([{ ticketId: 1, aliasId: 7 }]);
      });

      it("writes no link row at all when the ticket names nothing", async () => {
        asDomainOwner();
        offers([], []);
        acceptsSave();
        await svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b" }, caller(CREATOR));
        expect(ticketRecipients.save).not.toHaveBeenCalled();
        expect(ticketAliases.save).not.toHaveBeenCalled();
      });

      it("drops a duplicate id rather than linking it twice", async () => {
        asDomainOwner();
        offers([MAILBOX], []);
        acceptsSave();
        await svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b", recipientIds: [3, 3] }, caller(CREATOR));
        expect(ticketRecipients.save).toHaveBeenCalledWith([{ ticketId: 1, recipientId: 3 }]);
      });

      it("refuses a mailbox the caller was never offered", async () => {
        asDomainOwner();
        offers([MAILBOX], []);
        await expect(
          svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b", recipientIds: [999] }, caller(CREATOR))
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it("refuses an alias the caller was never offered", async () => {
        asDomainOwner();
        offers([], [ALIAS]);
        await expect(
          svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b", aliasIds: [999] }, caller(CREATOR))
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      // The heart of it: the mailbox exists on the domain, the caller reaches
      // the domain, but it is not theirs, so it was never offered and naming it
      // by hand is refused.
      it("refuses a mailbox of the domain the caller does not own", async () => {
        offers([], []);
        await expect(
          svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b", recipientIds: [3] }, caller(CREATOR))
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    // A domain with no address at all cannot satisfy the rule, so the rule does
    // not apply to it: the very domain being set up must stay reachable.
    it("still takes a ticket on a domain that has no address at all", async () => {
      appSettings.get.mockReturnValue({ ...APP_SETTINGS_DEFAULTS, ticketResourcesRequired: true });
      offers([], []);
      acceptsSave();
      await expect(svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b" }, caller(CREATOR))).resolves.toMatchObject({
        id: 1,
      });
    });

    it("resolves the linked rows back to addresses on the ticket", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR }));
      ticketRecipients.find.mockResolvedValue([entity<SupportTicketRecipient>({ ticketId: 5, recipientId: 3 })]);
      ticketAliases.find.mockResolvedValue([entity<SupportTicketAlias>({ ticketId: 5, aliasId: 7 })]);
      recipients.find.mockResolvedValue([MAILBOX]);
      aliases.find.mockResolvedValue([ALIAS]);
      const detail = await svc.get(5, caller(CREATOR));
      expect(detail.recipients).toEqual([{ id: 3, email: "sales@example.com" }]);
      expect(detail.aliases).toEqual([{ id: 7, source: "info@example.com", destination: "sales@example.com" }]);
    });

    it("reads a ticket with no link row as naming nothing", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR }));
      const detail = await svc.get(5, caller(CREATOR));
      expect(detail.recipients).toEqual([]);
      expect(detail.aliases).toEqual([]);
    });
  });

  describe("list rows", () => {
    it("narrows to the tickets the caller took in charge when asked", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      await svc.list({ offset: 0, sortDir: "desc", mine: "true" }, caller(SUPPORT, true));
      const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(clauses.some((c) => c.includes("assignedTo"))).toBe(true);
    });

    it("drops the closed tickets when asked", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      await svc.list({ offset: 0, sortDir: "desc", hideClosed: "true" }, caller(SUPPORT, true));
      const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(clauses.some((c) => c.includes("t.status != :closedStatus"))).toBe(true);
    });

    it("keeps the closed ones when the filter is off", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      await svc.list({ offset: 0, sortDir: "desc", hideClosed: "false" }, caller(SUPPORT, true));
      const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(clauses.some((c) => c.includes("closedStatus"))).toBe(false);
    });

    it("keeps the whole list when the filter is off", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      await svc.list({ offset: 0, sortDir: "desc" }, caller(SUPPORT, true));
      const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(clauses.some((c) => c.includes("assignedTo"))).toBe(false);
    });

    // What matters is who spoke last, not whether the caller ever wrote: a
    // ticket they answered long ago is waiting again as soon as the other side
    // replies.
    it("flags a ticket whose last message comes from someone else", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([ticketRow({ id: 5 }), ticketRow({ id: 6 })]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      const messagesQb = qbMock<SupportTicketMessage>();
      messagesQb.getRawMany.mockResolvedValue([
        { ticketId: 5, authorId: STRANGER },
        { ticketId: 6, authorId: CREATOR },
      ]);
      messages.createQueryBuilder.mockReturnValue(messagesQb);
      const rows = await svc.list({ offset: 0, sortDir: "desc" }, caller(CREATOR, true));
      expect(Array.isArray(rows) ? rows.map((r) => r.awaitingMyReply) : []).toEqual([true, false]);
    });

    it("does not flag a ticket with no message at all", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([ticketRow({ id: 5 })]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      const rows = await svc.list({ offset: 0, sortDir: "desc" }, caller(CREATOR, true));
      expect(Array.isArray(rows) && rows[0]?.awaitingMyReply).toBe(false);
    });

    it("carries the author identity next to the assignee", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([ticketRow({ createdBy: CREATOR, assignedTo: SUPPORT })]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      accounts.find.mockResolvedValue([
        entity<Account>({ id: CREATOR, email: "creator@example.com" }),
        entity<Account>({ id: SUPPORT, email: "support@example.com" }),
      ]);
      const rows = (await svc.list({ offset: 0, sortDir: "desc" }, caller(CREATOR, true))) as { creatorName: string }[];
      expect(rows[0]).toMatchObject({ creatorName: "creator@example.com", assigneeName: "support@example.com" });
    });
  });

  describe("message paging and identity", () => {
    beforeEach(() => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      messages.findAndCount.mockResolvedValue([
        [
          entity<SupportTicketMessage>({ id: 2, authorId: CREATOR, body: "second" }),
          entity<SupportTicketMessage>({ id: 1, authorId: CREATOR, body: "first" }),
        ],
        42,
      ]);
      accounts.find.mockResolvedValue([entity<Account>({ id: CREATOR, email: "creator@example.com" })]);
    });

    it("ships only the last page of a long thread, oldest first inside the page", async () => {
      const detail = await svc.get(5, caller(CREATOR));
      expect(messages.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: MESSAGE_PAGE, order: { createdAt: "DESC", id: "DESC" } })
      );
      expect(detail.messages.map((m) => m.id)).toEqual([1, 2]);
      expect(detail.messagesTotal).toBe(42);
    });

    it("resolves the author display name and avatar of each message", async () => {
      profiles.find.mockResolvedValue([
        entity<AccountProfile>({ accountId: CREATOR, firstName: "Jane", avatarUrl: "https://x/a.png" }),
      ]);
      const detail = await svc.get(5, caller(CREATOR));
      expect(detail.messages[0]).toMatchObject({
        authorEmail: "creator@example.com",
        authorName: "Jane",
        authorAvatarUrl: "https://x/a.png",
      });
    });

    it("falls back to the email when the account set no display name", async () => {
      const detail = await svc.get(5, caller(CREATOR));
      expect(detail.messages[0]).toMatchObject({ authorName: "creator@example.com", authorAvatarUrl: null });
    });

    it("serves an older page at the requested offset", async () => {
      await svc.messagesPage(5, caller(CREATOR), { offset: 20, limit: 10, sortDir: "desc" });
      expect(messages.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it("refuses a page of a ticket the caller cannot see", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      await expect(svc.messagesPage(5, caller(STRANGER), { offset: 0, sortDir: "desc" })).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe("editMessage", () => {
    const recent = () =>
      entity<SupportTicketMessage>({
        id: 9,
        ticketId: 5,
        authorId: CREATOR,
        body: "old",
        createdAt: new Date(Date.now() - 60_000),
        editCount: 0,
      });

    beforeEach(() => messages.save.mockImplementation((m) => Promise.resolve(m)));

    it("lets the author reword a recent message, stamping updated_at and bumping edit_count", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ status: "open", createdBy: CREATOR }));
      messages.findOne.mockResolvedValue(recent());
      const saved = await svc.editMessage(5, 9, "reworded", caller(CREATOR));
      expect(saved.body).toBe("reworded");
      expect(saved.editCount).toBe(1);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it("refuses to edit someone else's message", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ status: "open", createdBy: CREATOR }));
      messages.findOne.mockResolvedValue(
        entity<SupportTicketMessage>({ id: 9, ticketId: 5, authorId: STRANGER, createdAt: new Date(), editCount: 0 })
      );
      await expect(svc.editMessage(5, 9, "x", caller(CREATOR))).rejects.toBeInstanceOf(ForbiddenException);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("refuses to edit a message older than an hour", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ status: "open", createdBy: CREATOR }));
      messages.findOne.mockResolvedValue(
        entity<SupportTicketMessage>({
          id: 9,
          ticketId: 5,
          authorId: CREATOR,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          editCount: 0,
        })
      );
      await expect(svc.editMessage(5, 9, "x", caller(CREATOR))).rejects.toBeInstanceOf(ForbiddenException);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("refuses to edit in a closed ticket", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ status: "closed", createdBy: CREATOR }));
      messages.findOne.mockResolvedValue(recent());
      await expect(svc.editMessage(5, 9, "x", caller(CREATOR))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("404s when the message does not exist", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ status: "open", createdBy: CREATOR }));
      messages.findOne.mockResolvedValue(null);
      await expect(svc.editMessage(5, 9, "x", caller(CREATOR))).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("domain access", () => {
    beforeEach(() => messages.findAndCount.mockResolvedValue([[], 0]));

    it("hides a ticket whose domain the caller has no access to", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [{ domainId: 999 }] });
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.get(5, caller(STRANGER))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("hides it even from the support role", async () => {
      cpg.guard.utils.check.global.mockResolvedValue(true);
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [{ domainId: 999 }] });
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.get(5, caller(SUPPORT))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("counts a domain the caller owns as accessible", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [] });
      domains.find.mockResolvedValue([entity<VirtualDomain>({ id: DOMAIN_ID })]);
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.get(5, caller(STRANGER))).resolves.toMatchObject({ id: 5 });
    });

    it("counts a domain where the caller merely owns a mailbox as accessible", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [] });
      recipients.find.mockResolvedValue([entity<VirtualUser>({ domain: "example.com" })]);
      domains.find.mockResolvedValueOnce([]).mockResolvedValueOnce([entity<VirtualDomain>({ id: DOMAIN_ID })]);
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.get(5, caller(STRANGER))).resolves.toMatchObject({ id: 5 });
    });

    it("counts a domain where the caller merely owns an alias as accessible", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [] });
      aliases.find.mockResolvedValue([entity<VirtualAlias>({ domain: "example.com" })]);
      domains.find.mockResolvedValueOnce([]).mockResolvedValueOnce([entity<VirtualDomain>({ id: DOMAIN_ID })]);
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.get(5, caller(STRANGER))).resolves.toMatchObject({ id: 5 });
    });

    it("counts a domain where the caller holds a delegation as accessible", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [] });
      delegations.find.mockResolvedValue([entity<DomainDelegation>({ domainId: DOMAIN_ID })]);
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.get(5, caller(STRANGER))).resolves.toMatchObject({ id: 5 });
    });

    it("ticketableDomains resolves the reachable domains to names for the creation form", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [] });
      delegations.find.mockResolvedValue([entity<DomainDelegation>({ domainId: DOMAIN_ID })]);
      domains.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([entity<VirtualDomain>({ id: DOMAIN_ID, domain: "example.com" })]);
      await expect(svc.ticketableDomains(caller(STRANGER))).resolves.toEqual([{ id: DOMAIN_ID, domain: "example.com" }]);
    });

    it("ticketableDomains lists every domain for root", async () => {
      domains.find.mockResolvedValue([
        entity<VirtualDomain>({ id: 1, domain: "a.io" }),
        entity<VirtualDomain>({ id: 2, domain: "b.io" }),
      ]);
      await expect(svc.ticketableDomains(caller(ROOT_ID, true))).resolves.toEqual([
        { id: 1, domain: "a.io" },
        { id: 2, domain: "b.io" },
      ]);
    });

    it("lets domains:list-all-domains see every domain's tickets", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({
        global: [{ resource: "domains", action: "list-all-domains" }],
        domain: [],
      });
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.get(5, caller(STRANGER))).resolves.toMatchObject({ id: 5 });
    });

    it("returns an empty list when the caller can reach no domain at all", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [] });
      domains.find.mockResolvedValue([]);
      await expect(svc.list({ offset: 0, sortDir: "desc" }, caller(STRANGER))).resolves.toEqual([]);
      expect(tickets.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("filters the list to the caller's domains", async () => {
      const qb = qbMock<SupportTicket>();
      qb.getMany.mockResolvedValue([]);
      tickets.createQueryBuilder.mockReturnValue(qb);
      await svc.list({ offset: 0, sortDir: "desc" }, caller(STRANGER));
      const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(clauses.some((c) => c.includes("domainId IN"))).toBe(true);
    });

    it("refuses to open a ticket about an inaccessible domain", async () => {
      cpg.guard.getEffectivePermissions.mockResolvedValue({ global: [], domain: [{ domainId: 999 }] });
      await expect(svc.create({ domainId: DOMAIN_ID, subject: "a", body: "b" }, caller(STRANGER))).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });
  });

  describe("notifications", () => {
    const ACTOR = "actor-id";
    const NEIGHBOUR = "neighbour-id";

    function population(ids: string[]) {
      accounts.find.mockImplementation((opts?: { where?: { enabled?: number } }) =>
        Promise.resolve(
          opts?.where?.enabled === 1
            ? ids.map((id) => entity<Account>({ id, isRoot: 0, enabled: 1 }))
            : ids.map((id) => entity<Account>({ id, email: `${id}@example.com` }))
        )
      );
    }

    // Per-account answers: `notification` is the prerequisite to be reachable,
    // `handle-ticket` is what makes an account support staff.
    function holders(perAccount: Record<string, string[]>) {
      cpg.guard.utils.check.global.mockImplementation((userId: string, _resource: string, action: string) =>
        Promise.resolve((perAccount[userId] ?? []).includes(action))
      );
    }

    function domainsOf(perAccount: Record<string, number[]>) {
      cpg.guard.getEffectivePermissions.mockImplementation((userId: string) =>
        Promise.resolve({ global: [], domain: (perAccount[userId] ?? []).map((domainId) => ({ domainId })) })
      );
    }

    const dispatched = () => notifications.dispatch.mock.calls[0]?.[0];

    beforeEach(() => {
      messages.findAndCount.mockResolvedValue([[], 0]);
      tickets.save.mockImplementation((t: SupportTicket) => Promise.resolve(t));
      messages.save.mockResolvedValue(entity<SupportTicketMessage>({ id: 1 }));
      tickets.create.mockImplementation((t: Partial<SupportTicket>) => entity<SupportTicket>({ id: 5, ...t }));
      messages.create.mockImplementation((m: Partial<SupportTicketMessage>) => entity<SupportTicketMessage>(m));
      domains.find.mockImplementation((opts?: { select?: { domain?: boolean } }) =>
        Promise.resolve(opts?.select?.domain ? [entity<VirtualDomain>({ id: DOMAIN_ID, domain: "example.com" })] : [])
      );
      population([ACTOR, NEIGHBOUR]);
      holders({ [NEIGHBOUR]: ["notification", "handle-ticket"] });
      domainsOf({ [ACTOR]: [DOMAIN_ID], [NEIGHBOUR]: [DOMAIN_ID] });
    });

    it("notifies an eligible account when a ticket is opened", async () => {
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(dispatched()).toMatchObject({ accountIds: [NEIGHBOUR], source: "support", type: "ticket-created" });
    });

    it("never notifies the actor about their own action", async () => {
      holders({ [ACTOR]: ["notification", "handle-ticket"], [NEIGHBOUR]: ["notification", "handle-ticket"] });
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(dispatched().accountIds).not.toContain(ACTOR);
    });

    it("never notifies an account without access to the ticket's domain", async () => {
      domainsOf({ [ACTOR]: [DOMAIN_ID], [NEIGHBOUR]: [999] });
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    it("narrows to the author and the handler once the ticket is taken in charge", async () => {
      const THIRD = "third-support-id";
      population([ACTOR, NEIGHBOUR, THIRD]);
      holders({
        [ACTOR]: ["notification", "handle-ticket"],
        [NEIGHBOUR]: ["notification", "handle-ticket"],
        [THIRD]: ["notification", "handle-ticket"],
      });
      domainsOf({ [ACTOR]: [DOMAIN_ID], [NEIGHBOUR]: [DOMAIN_ID], [THIRD]: [DOMAIN_ID] });
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: NEIGHBOUR, assignedTo: ACTOR, visibility: "public" }));
      await svc.setStatus(5, "resolved", caller(ACTOR));
      expect(dispatched().accountIds).toEqual([NEIGHBOUR]);
    });

    it("still reaches the whole eligible support while the ticket is unassigned", async () => {
      const THIRD = "third-support-id";
      population([ACTOR, NEIGHBOUR, THIRD]);
      holders({
        [NEIGHBOUR]: ["notification", "handle-ticket"],
        [THIRD]: ["notification", "handle-ticket"],
      });
      domainsOf({ [ACTOR]: [DOMAIN_ID], [NEIGHBOUR]: [DOMAIN_ID], [THIRD]: [DOMAIN_ID] });
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(dispatched().accountIds).toEqual([NEIGHBOUR, THIRD]);
    });

    it("notifies the handler when the author replies on an assigned ticket", async () => {
      const THIRD = "third-support-id";
      population([ACTOR, NEIGHBOUR, THIRD]);
      holders({
        [NEIGHBOUR]: ["notification", "handle-ticket"],
        [THIRD]: ["notification", "handle-ticket"],
      });
      domainsOf({ [ACTOR]: [DOMAIN_ID], [NEIGHBOUR]: [DOMAIN_ID], [THIRD]: [DOMAIN_ID] });
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: ACTOR, assignedTo: NEIGHBOUR, visibility: "public" }));
      tickets.createQueryBuilder.mockReturnValue(updateQb());
      await svc.reply(5, { body: "up" }, caller(ACTOR));
      expect(dispatched().accountIds).toEqual([NEIGHBOUR]);
    });

    it("notifies only the author when a third party takes the ticket in charge", async () => {
      const THIRD = "third-support-id";
      population([ACTOR, NEIGHBOUR, THIRD]);
      holders({
        [ACTOR]: ["notification", "handle-ticket"],
        [NEIGHBOUR]: ["notification"],
        [THIRD]: ["notification", "handle-ticket"],
      });
      domainsOf({ [ACTOR]: [DOMAIN_ID], [NEIGHBOUR]: [DOMAIN_ID], [THIRD]: [DOMAIN_ID] });
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: NEIGHBOUR, visibility: "public" }));
      await svc.take(5, caller(ACTOR));
      expect(dispatched()).toMatchObject({ accountIds: [NEIGHBOUR], type: "ticket-taken" });
    });

    it("does not notify an account that already has the thread open", async () => {
      presence.join(NEIGHBOUR, "ticket:5");
      tickets.create.mockImplementation((t: Partial<SupportTicket>) => entity<SupportTicket>({ id: 5, ...t }));
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    // dispatch is the single path to both channels, so an account filtered out
    // here receives neither the in-app row nor the mail.
    it("cuts both channels for the reader while still reaching the others", async () => {
      const THIRD = "third-support-id";
      population([ACTOR, NEIGHBOUR, THIRD]);
      holders({
        [NEIGHBOUR]: ["notification", "handle-ticket"],
        [THIRD]: ["notification", "handle-ticket"],
      });
      domainsOf({ [ACTOR]: [DOMAIN_ID], [NEIGHBOUR]: [DOMAIN_ID], [THIRD]: [DOMAIN_ID] });
      presence.join(NEIGHBOUR, "ticket:5");
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: ACTOR, visibility: "public" }));
      tickets.createQueryBuilder.mockReturnValue(updateQb());
      await svc.reply(5, { body: "up" }, caller(ACTOR));
      expect(dispatched().accountIds).toEqual([THIRD]);
      expect(dispatched().accountIds).not.toContain(NEIGHBOUR);
    });

    it("still notifies an account watching a different thread", async () => {
      presence.join(NEIGHBOUR, "ticket:999");
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(dispatched().accountIds).toEqual([NEIGHBOUR]);
    });

    it("notifies again once the account closes the thread", async () => {
      presence.join(NEIGHBOUR, "ticket:5");
      presence.leave(NEIGHBOUR, "ticket:5");
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(dispatched().accountIds).toEqual([NEIGHBOUR]);
    });

    it("never notifies an account lacking the tickets:notification action", async () => {
      holders({ [NEIGHBOUR]: ["handle-ticket"] });
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    it("keeps a private ticket out of a non-support account's notifications", async () => {
      holders({ [NEIGHBOUR]: ["notification"] });
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b", visibility: "private" }, caller(ACTOR));
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    it("reaches a non-support account on a public ticket", async () => {
      holders({ [NEIGHBOUR]: ["notification"] });
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b", visibility: "public" }, caller(ACTOR));
      expect(dispatched().accountIds).toEqual([NEIGHBOUR]);
    });

    it("notifies the author when someone replies", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: NEIGHBOUR, visibility: "private" }));
      holders({ [ACTOR]: ["notification", "handle-ticket", "reply-ticket"], [NEIGHBOUR]: ["notification"] });
      tickets.createQueryBuilder.mockReturnValue(updateQb());
      await svc.reply(5, { body: "answer" }, caller(ACTOR));
      expect(dispatched()).toMatchObject({ accountIds: [NEIGHBOUR], type: "ticket-replied" });
    });

    it("notifies the author when the ticket is taken in charge", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: NEIGHBOUR, visibility: "private" }));
      holders({ [ACTOR]: ["notification", "handle-ticket"], [NEIGHBOUR]: ["notification"] });
      await svc.take(5, caller(ACTOR));
      expect(dispatched()).toMatchObject({ accountIds: [NEIGHBOUR], type: "ticket-taken" });
    });

    it("carries the new status in the payload on a status change", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: NEIGHBOUR, visibility: "private" }));
      holders({ [ACTOR]: ["notification", "handle-ticket"], [NEIGHBOUR]: ["notification"] });
      await svc.setStatus(5, "resolved", caller(ACTOR));
      expect(dispatched()).toMatchObject({ type: "ticket-status", payload: expect.objectContaining({ status: "resolved" }) });
    });

    it("carries the domain and the ticket link in the payload", async () => {
      await svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR));
      expect(dispatched()).toMatchObject({
        link: "/admin/tickets/5",
        payload: expect.objectContaining({ ticketId: 5, subject: "help", domainName: "example.com" }),
      });
    });

    it("never fails the request when the notification layer throws", async () => {
      notifications.dispatch.mockRejectedValue(new Error("db down"));
      await expect(svc.create({ domainId: DOMAIN_ID, subject: "help", body: "b" }, caller(ACTOR))).resolves.toMatchObject({
        id: 5,
      });
    });
  });

  describe("thread and canWatch (realtime)", () => {
    beforeEach(() => messages.findAndCount.mockResolvedValue([[], 0]));

    it("thread returns the detail of an existing ticket", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.thread(5)).resolves.toMatchObject({ id: 5 });
    });

    it("thread returns null for a missing ticket", async () => {
      tickets.findOne.mockResolvedValue(null);
      await expect(svc.thread(404)).resolves.toBeNull();
    });

    it("canWatch allows a caller who may see the ticket", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      await expect(svc.canWatch(5, caller(CREATOR))).resolves.toBe(true);
    });

    it("canWatch refuses a caller lacking the view action", async () => {
      cpg.guard.assertOne.global.mockRejectedValue(new Error("denied"));
      await expect(svc.canWatch(5, caller(STRANGER))).resolves.toBe(false);
    });

    it("canWatch refuses a caller who cannot see the row", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      await expect(svc.canWatch(5, caller(STRANGER))).resolves.toBe(false);
    });

    it("canWatch lets root through without the action check", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      await expect(svc.canWatch(5, caller(ROOT_ID, true))).resolves.toBe(true);
    });
  });

  describe("read receipts", () => {
    beforeEach(() => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "public" }));
      messages.findAndCount.mockResolvedValue([[], 0]);
      reads.create.mockImplementation((r: Partial<SupportTicketRead>) => entity<SupportTicketRead>(r));
    });

    it("records the newest message as read for the caller", async () => {
      messages.find.mockResolvedValue([entity<SupportTicketMessage>({ id: 42 })]);
      await expect(svc.markRead(5, caller(CREATOR))).resolves.toEqual({ lastReadMessageId: 42 });
      expect(reads.create).toHaveBeenCalledWith({ ticketId: 5, accountId: CREATOR, lastReadMessageId: 42 });
    });

    it("records zero on a thread with no message yet", async () => {
      messages.find.mockResolvedValue([]);
      await expect(svc.markRead(5, caller(CREATOR))).resolves.toEqual({ lastReadMessageId: 0 });
    });

    // Coming back to an older page must not un-read what was already seen.
    it("never moves a receipt backwards", async () => {
      messages.find.mockResolvedValue([entity<SupportTicketMessage>({ id: 10 })]);
      reads.findOne.mockResolvedValue(entity<SupportTicketRead>({ lastReadMessageId: 40 }));
      await svc.markRead(5, caller(CREATOR));
      expect(reads.save).not.toHaveBeenCalled();
    });

    it("refuses to mark a ticket the caller cannot see", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ visibility: "private", createdBy: CREATOR }));
      await expect(svc.markRead(5, caller(STRANGER))).rejects.toBeInstanceOf(NotFoundException);
    });

    it("exposes each reader and how far they read on the thread", async () => {
      reads.find.mockResolvedValue([entity<SupportTicketRead>({ accountId: CREATOR, lastReadMessageId: 7 })]);
      accounts.find.mockResolvedValue([entity<Account>({ id: CREATOR, email: "creator@example.com" })]);
      const detail = await svc.get(5, caller(CREATOR));
      expect(detail.readers).toEqual([
        expect.objectContaining({ accountId: CREATOR, lastReadMessageId: 7, name: "creator@example.com" }),
      ]);
    });
  });

  describe("reply", () => {
    beforeEach(() => {
      messages.findAndCount.mockResolvedValue([[], 0]);
      messages.save.mockResolvedValue(entity<SupportTicketMessage>({ id: 1 }));
      messages.create.mockImplementation((m: Partial<SupportTicketMessage>) => entity<SupportTicketMessage>(m));
      tickets.createQueryBuilder.mockReturnValue(updateQb());
      accounts.find.mockResolvedValue([]);
    });

    it("lets the author answer their own ticket without the reply-ticket action", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, visibility: "private" }));
      cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.reply(5, { body: "up" }, caller(CREATOR))).resolves.toMatchObject({ id: 1 });
    });

    it("refuses a third party without the reply-ticket action", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, visibility: "public" }));
      cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.reply(5, { body: "up" }, caller(STRANGER))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("lets a third party holding reply-ticket answer", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, visibility: "public" }));
      cpg.guard.utils.check.global.mockImplementation((_u: string, _r: string, action: string) =>
        Promise.resolve(action === "reply-ticket")
      );
      await expect(svc.reply(5, { body: "up" }, caller(STRANGER))).resolves.toMatchObject({ id: 1 });
    });

    it("lets root answer any ticket", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, visibility: "private" }));
      cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.reply(5, { body: "up" }, caller(ROOT_ID, true))).resolves.toMatchObject({ id: 1 });
    });

    it("refuses any message on a closed ticket, even from its author", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, status: "closed" }));
      await expect(svc.reply(5, { body: "up" }, caller(CREATOR))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("refuses a message on a closed ticket even from root", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, status: "closed" }));
      await expect(svc.reply(5, { body: "up" }, caller(ROOT_ID, true))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("still accepts a message on a resolved ticket", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, status: "resolved" }));
      await expect(svc.reply(5, { body: "up" }, caller(CREATOR))).resolves.toMatchObject({ id: 1 });
    });
  });

  describe("setStatus", () => {
    beforeEach(() => {
      messages.findAndCount.mockResolvedValue([[], 0]);
      tickets.save.mockImplementation((t: SupportTicket) => Promise.resolve(t));
      accounts.find.mockResolvedValue([]);
    });

    it("lets the author close their own ticket without the support role", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, status: "open" }));
      cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.setStatus(5, "closed", caller(CREATOR))).resolves.toMatchObject({ status: "closed" });
    });

    it("refuses any other status change from the author", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, status: "open" }));
      cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.setStatus(5, "resolved", caller(CREATOR))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("refuses the author reopening their closed ticket", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, status: "closed" }));
      cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.setStatus(5, "open", caller(CREATOR))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("refuses a third party without the support role", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, visibility: "public" }));
      cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.setStatus(5, "closed", caller(STRANGER))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("lets the support role set any status", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR, visibility: "public" }));
      cpg.guard.utils.check.global.mockImplementation((_u: string, _r: string, action: string) =>
        Promise.resolve(action === "handle-ticket")
      );
      await expect(svc.setStatus(5, "resolved", caller(STRANGER))).resolves.toMatchObject({ status: "resolved" });
    });

    it("lets root set any status", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR }));
      cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.setStatus(5, "resolved", caller(ROOT_ID, true))).resolves.toMatchObject({ status: "resolved" });
    });
  });

  describe("take", () => {
    beforeEach(() => cpg.guard.utils.check.global.mockResolvedValue(true));

    it("refuses to let the author take charge of their own ticket", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ createdBy: CREATOR }));
      await expect(svc.take(5, caller(CREATOR))).rejects.toBeInstanceOf(ForbiddenException);
      expect(tickets.save).not.toHaveBeenCalled();
    });

    it("assigns the ticket to another account and moves an open ticket to in_progress", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ status: "open", createdBy: CREATOR }));
      tickets.save.mockImplementation(async (t) => t as SupportTicket);
      const result = (await svc.take(5, caller(SUPPORT))) as SupportTicket;
      expect(result.assignedTo).toBe(SUPPORT);
      expect(result.status).toBe("in_progress");
    });

    it("does not rewind a resolved ticket to in_progress", async () => {
      tickets.findOne.mockResolvedValue(ticketRow({ status: "resolved", createdBy: CREATOR }));
      tickets.save.mockImplementation(async (t) => t as SupportTicket);
      const result = (await svc.take(5, caller(SUPPORT))) as SupportTicket;
      expect(result.status).toBe("resolved");
    });
  });
});
