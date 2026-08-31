import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import type { Repository, SelectQueryBuilder } from "typeorm";
import { DelegationsService } from "../../src/api/domains/delegations/delegations.service";
import { ApiError } from "../../src/core/common/api-error";
import { Account } from "../../src/core/entities/account.entity";
import { AccountInvitation } from "../../src/core/entities/account-invitation.entity";
import { DomainDelegation } from "../../src/core/entities/domain-delegation.entity";
import { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import type { MailerService } from "../../src/core/mailer/mailer.service";
import type { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { type Loose, entity, providerMock, qbMock, repoMock } from "../helpers/mocks";

const MB = 1024 * 1024;
const FQDN = "example.com";

function qbSum(bytes: number): Loose<SelectQueryBuilder<VirtualUser>> {
  const qb = qbMock<VirtualUser>();
  qb.getRawOne.mockResolvedValue({ sum: String(bytes) });
  return qb;
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("expected the promise to reject, but it resolved");
}

describe("DelegationsService", () => {
  let delegations: Loose<Repository<DomainDelegation>>;
  let domains: Loose<Repository<VirtualDomain>>;
  let recipients: Loose<Repository<VirtualUser>>;
  let aliases: Loose<Repository<VirtualAlias>>;
  let accounts: Loose<Repository<Account>>;
  let invitations: Loose<Repository<AccountInvitation>>;
  let mailer: Loose<MailerService>;
  let appSettings: Loose<AppSettingsService>;
  let svc: DelegationsService;

  const caps = { maxRecipients: 5, maxAliases: 7, quotaMb: 100, expiresDays: 7, note: null };

  beforeEach(() => {
    delegations = repoMock<DomainDelegation>();
    domains = repoMock<VirtualDomain>();
    recipients = repoMock<VirtualUser>();
    aliases = repoMock<VirtualAlias>();
    accounts = repoMock<Account>();
    invitations = repoMock<AccountInvitation>();
    mailer = providerMock<MailerService>({ sendInvitation: vi.fn(async () => undefined) });
    appSettings = providerMock<AppSettingsService>({
      get: vi.fn().mockReturnValue({ offlineNotifyAfterMs: 0, offlineSweepIntervalMs: 0, mailMinIntervalMs: 0, managerUrl: "" }),
    });
    svc = new DelegationsService(delegations, domains, recipients, aliases, accounts, invitations, mailer, appSettings);
    delegations.save.mockImplementation(async (x: object) => x);
    invitations.save.mockImplementation(async (x: object) => x);
    invitations.find.mockResolvedValue([]);
    recipients.count.mockResolvedValue(0);
    aliases.count.mockResolvedValue(0);
    recipients.createQueryBuilder.mockImplementation(() => qbSum(0));
    domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: 1, domain: FQDN, ownerId: "owner", quota: String(1000 * MB) }));
  });

  describe("reservedForAccountsBytes", () => {
    it("404s on an unknown domain", async () => {
      domains.findOne.mockResolvedValue(null);
      await expect(svc.reservedForAccountsBytes(9)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("counts pending invitations and open links as reserved from the moment they are issued", async () => {
      delegations.find.mockResolvedValue([]);
      invitations.find.mockResolvedValue([
        entity<AccountInvitation>({ id: 5, delegationQuotaMb: 100 }),
        entity<AccountInvitation>({ id: 6, delegationQuotaMb: 24 }),
      ]);
      await expect(svc.reservedForAccountsBytes(1)).resolves.toBe(124 * MB);
    });

    it("sums each delegation's still unused quota, never below zero", async () => {
      delegations.find.mockResolvedValue([
        entity<DomainDelegation>({ accountId: "a", quotaMb: 100 }),
        entity<DomainDelegation>({ accountId: "b", quotaMb: 50 }),
      ]);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(40 * MB)).mockReturnValueOnce(qbSum(999 * MB));
      await expect(svc.reservedForAccountsBytes(1)).resolves.toBe(60 * MB);
    });
  });

  describe("grantOrInvite (anti-overcommit + branches)", () => {
    it("refuses a grant beyond what the domain can still commit", async () => {
      accounts.findOne.mockResolvedValue(null);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(950 * MB));
      delegations.find.mockResolvedValue([]);
      const e = await rejection(svc.grantOrInvite("admin", 1, { email: "new@x.io", ...caps }, "http://x"));
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).getResponse()).toMatchObject({
        code: "delegations.quotaExceedsDomain",
        params: { grantableMb: 50, requestedMb: 100 },
      });
      expect(invitations.save).not.toHaveBeenCalled();
    });

    it("counts pending invitations against the grantable space (no overcommit through stacked links)", async () => {
      accounts.findOne.mockResolvedValue(null);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(0));
      delegations.find.mockResolvedValue([]);
      invitations.findOne.mockResolvedValue(null);
      invitations.find.mockResolvedValue([entity<AccountInvitation>({ id: 5, delegationQuotaMb: 950 })]);
      const e = await rejection(svc.grantOrInvite("admin", 1, { email: "new@x.io", ...caps }, "http://x"));
      expect((e as ApiError).getResponse()).toMatchObject({
        code: "delegations.quotaExceedsDomain",
        params: { grantableMb: 50, requestedMb: 100 },
      });
      expect(invitations.save).not.toHaveBeenCalled();
    });

    it("counts other delegations' unused reserves against the grantable space", async () => {
      accounts.findOne.mockResolvedValue(null);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(0)).mockReturnValueOnce(qbSum(0));
      delegations.find.mockResolvedValue([entity<DomainDelegation>({ accountId: "other", quotaMb: 950 })]);
      const e = await rejection(svc.grantOrInvite("admin", 1, { email: "new@x.io", ...caps }, "http://x"));
      expect((e as ApiError).getResponse()).toMatchObject({ params: { grantableMb: 50 } });
    });

    it("never bounds a grant on an unlimited domain (quota 0)", async () => {
      domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: 1, domain: FQDN, ownerId: "owner", quota: "0" }));
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "acc", email: "acc@x.io" }));
      delegations.findOne.mockResolvedValue(null);
      await expect(
        svc.grantOrInvite("admin", 1, { email: "acc@x.io", quotaMb: 999999, maxRecipients: null, maxAliases: null, expiresDays: null }, "http://x")
      ).resolves.toMatchObject({ mode: "granted" });
    });

    it("refuses to delegate to the domain owner", async () => {
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "owner", email: "owner@x.io" }));
      const e = await rejection(svc.grantOrInvite("admin", 1, { email: "owner@x.io", ...caps }, "http://x"));
      expect((e as ApiError).getResponse()).toMatchObject({ code: "delegations.ownerNotDelegable" });
    });

    it("grants an existing account on the spot (upsert, no invitation)", async () => {
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "acc", email: "acc@x.io" }));
      recipients.createQueryBuilder.mockReturnValue(qbSum(0));
      delegations.find.mockResolvedValue([]);
      delegations.findOne.mockResolvedValue(null);
      const res = await svc.grantOrInvite("admin", 1, { email: "acc@x.io", ...caps }, "http://x");
      expect(res).toEqual({ mode: "granted", email: "acc@x.io" });
      expect(delegations.save).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: "acc", domainId: 1, maxRecipients: 5, maxAliases: 7, quotaMb: 100 })
      );
      expect(mailer.sendInvitation).not.toHaveBeenCalled();
    });

    it("invites an unknown email with the caps staged and sends the mail", async () => {
      accounts.findOne.mockResolvedValue(null);
      recipients.createQueryBuilder.mockReturnValue(qbSum(0));
      delegations.find.mockResolvedValue([]);
      invitations.findOne.mockResolvedValue(null);
      const res = await svc.grantOrInvite("admin", 1, { email: "new@x.io", ...caps }, "http://mgr");
      expect(res).toEqual({ mode: "invited", email: "new@x.io" });
      expect(invitations.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@x.io",
          delegationDomainId: 1,
          delegationMaxRecipients: 5,
          delegationMaxAliases: 7,
          delegationQuotaMb: 100,
        })
      );
      expect(mailer.sendInvitation).toHaveBeenCalledWith(expect.objectContaining({ to: "new@x.io", fromDomain: FQDN, groupNames: [] }));
      expect(delegations.save).not.toHaveBeenCalled();
    });
  });

  describe("createToken (open registration link)", () => {
    it("stages a delegation invitation with no pinned email and returns the link", async () => {
      recipients.createQueryBuilder.mockReturnValue(qbSum(0));
      delegations.find.mockResolvedValue([]);
      const res = await svc.createToken("admin", 1, caps, "http://mgr");
      expect(res.token).toMatch(/^[0-9a-f]{64}$/);
      expect(res.link).toBe(`http://mgr/invite/${res.token}`);
      expect(invitations.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: null, delegationDomainId: 1, delegationQuotaMb: 100 })
      );
      expect(mailer.sendInvitation).not.toHaveBeenCalled();
    });

    it("stores the free note naming who the link is meant for", async () => {
      recipients.createQueryBuilder.mockReturnValue(qbSum(0));
      delegations.find.mockResolvedValue([]);
      await svc.createToken("admin", 1, { ...caps, note: "for Johnny" }, "http://mgr");
      expect(invitations.save).toHaveBeenCalledWith(expect.objectContaining({ email: null, note: "for Johnny" }));
    });

    it("applies the anti-overcommit bound to tokens too", async () => {
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(950 * MB));
      delegations.find.mockResolvedValue([]);
      const e = await rejection(svc.createToken("admin", 1, caps, "http://mgr"));
      expect((e as ApiError).getResponse()).toMatchObject({ code: "delegations.quotaExceedsDomain" });
      expect(invitations.save).not.toHaveBeenCalled();
    });
  });

  describe("createToken expiry", () => {
    it("null expiresDays stores no expiry: the link stands until revoked", async () => {
      recipients.createQueryBuilder.mockReturnValue(qbSum(0));
      delegations.find.mockResolvedValue([]);
      await svc.createToken("admin", 1, { maxRecipients: 1, maxAliases: 1, quotaMb: 10, expiresDays: null, note: null }, "http://x");
      expect(invitations.save).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: null }));
    });

    it("a pending link with no expiry still counts as reserved", async () => {
      delegations.find.mockResolvedValue([]);
      invitations.find.mockResolvedValue([entity<AccountInvitation>({ id: 5, delegationQuotaMb: 100, expiresAt: null })]);
      await expect(svc.reservedForAccountsBytes(1)).resolves.toBe(100 * MB);
    });
  });

  describe("editInvitation", () => {
    it("404s on an unknown or expired invitation", async () => {
      invitations.findOne.mockResolvedValue(null);
      await expect(svc.editInvitation(1, 9, { maxRecipients: 1, maxAliases: 1, quotaMb: 10, expiresDays: null, note: null })).rejects.toBeInstanceOf(
        NotFoundException
      );
      invitations.findOne.mockResolvedValue(entity<AccountInvitation>({ id: 9, acceptedAt: null, expiresAt: new Date(0) }));
      await expect(svc.editInvitation(1, 9, { maxRecipients: 1, maxAliases: 1, quotaMb: 10, expiresDays: null, note: null })).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("edits caps and expiry under anti-overcommit, its own promise excluded from the sum", async () => {
      const inv = entity<AccountInvitation>({ id: 9, acceptedAt: null, expiresAt: null, delegationQuotaMb: 50 });
      invitations.findOne.mockResolvedValue(inv);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(0));
      invitations.find.mockResolvedValue([inv]);
      delegations.find.mockResolvedValue([]);
      await expect(
        svc.editInvitation(1, 9, { maxRecipients: 2, maxAliases: null, quotaMb: 500, expiresDays: null, note: null })
      ).resolves.toEqual({
        ok: true,
      });
      expect(invitations.save).toHaveBeenCalledWith(
        expect.objectContaining({ delegationMaxRecipients: 2, delegationMaxAliases: null, delegationQuotaMb: 500, expiresAt: null })
      );
    });

    it("updates the note of an open link", async () => {
      const inv = entity<AccountInvitation>({ id: 9, email: null, acceptedAt: null, expiresAt: null, delegationQuotaMb: 50, note: "old" });
      invitations.findOne.mockResolvedValue(inv);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(0));
      invitations.find.mockResolvedValue([inv]);
      delegations.find.mockResolvedValue([]);
      await svc.editInvitation(1, 9, { maxRecipients: 1, maxAliases: 1, quotaMb: 10, expiresDays: null, note: "for Johnny" });
      expect(invitations.save).toHaveBeenCalledWith(expect.objectContaining({ note: "for Johnny" }));
    });

    it("leaves the note of an email invitation untouched", async () => {
      const inv = entity<AccountInvitation>({ id: 9, email: "a@x.io", acceptedAt: null, expiresAt: null, delegationQuotaMb: 50, note: null });
      invitations.findOne.mockResolvedValue(inv);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(0));
      invitations.find.mockResolvedValue([inv]);
      delegations.find.mockResolvedValue([]);
      await svc.editInvitation(1, 9, { maxRecipients: 1, maxAliases: 1, quotaMb: 10, expiresDays: null, note: "for Johnny" });
      expect(invitations.save).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
    });
  });

  describe("baseline: a grant of N allows N new resources", () => {
    it("snapshots the account's current counts when its first grant is born", async () => {
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "acc", email: "a@x.io" }));
      recipients.count.mockResolvedValue(3);
      aliases.count.mockResolvedValue(2);
      recipients.createQueryBuilder.mockImplementation(() => qbSum(50 * MB));
      delegations.find.mockResolvedValue([]);
      delegations.findOne.mockResolvedValue(null);
      await svc.grantOrInvite("admin", 1, { email: "a@x.io", ...caps }, "http://x");
      expect(delegations.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseRecipients: 3, baseAliases: 2, baseBytes: String(50 * MB) })
      );
    });

    it("stacks a further grant on the existing delegation, baseline kept", async () => {
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "acc", email: "a@x.io" }));
      const existing = entity<DomainDelegation>({
        accountId: "acc",
        domainId: 1,
        maxRecipients: 5,
        maxAliases: null,
        quotaMb: 500,
        baseRecipients: 2,
        baseAliases: 1,
        baseBytes: "0",
      });
      delegations.findOne.mockResolvedValue(existing);
      delegations.find.mockResolvedValue([existing]);
      await svc.grantOrInvite("admin", 1, { email: "a@x.io", maxRecipients: 5, maxAliases: 7, quotaMb: 100, expiresDays: 7 }, "http://x");
      expect(delegations.save).toHaveBeenCalledWith(
        expect.objectContaining({ maxRecipients: 10, maxAliases: null, quotaMb: 600, baseRecipients: 2 })
      );
    });

    it("meters usage beyond the baseline only", async () => {
      const d = entity<DomainDelegation>({ accountId: "acc", quotaMb: 100, baseRecipients: 1, baseAliases: 1, baseBytes: String(10 * MB) });
      recipients.count.mockResolvedValue(3);
      aliases.count.mockResolvedValue(1);
      recipients.createQueryBuilder.mockImplementation(() => qbSum(30 * MB));
      await expect(svc.usedRecipientsOf(d, FQDN)).resolves.toBe(2);
      await expect(svc.usedAliasesOf(d, FQDN)).resolves.toBe(0);
      await expect(svc.spentBytesOf(d, FQDN)).resolves.toBe(20 * MB);
    });

    it("lets a delegate create even when pre-existing mailboxes match the cap", async () => {
      const d = entity<DomainDelegation>({
        accountId: "acc",
        domainId: 1,
        maxRecipients: 4,
        maxAliases: null,
        quotaMb: 100,
        baseRecipients: 4,
        baseAliases: 0,
        baseBytes: "0",
      });
      delegations.findOne.mockResolvedValue(d);
      recipients.count.mockResolvedValue(4);
      await expect(svc.assertCanCreateRecipient("acc", 1, MB)).resolves.toBe(d);
    });
  });

  describe("assertCanRaiseQuota (raising an owned mailbox spends the budget)", () => {
    it("403s without a delegation on the domain", async () => {
      delegations.findOne.mockResolvedValue(null);
      const e = await rejection(svc.assertCanRaiseQuota("acc", FQDN, 10 * MB));
      expect((e as ApiError).getResponse()).toMatchObject({ code: "delegations.noDelegation" });
    });

    it("allows a raise fitting the remaining budget and any lowering", async () => {
      delegations.findOne.mockResolvedValue(entity<DomainDelegation>({ accountId: "acc", quotaMb: 100, baseBytes: "0" }));
      recipients.createQueryBuilder.mockImplementation(() => qbSum(40 * MB));
      await expect(svc.assertCanRaiseQuota("acc", FQDN, 60 * MB)).resolves.toBeUndefined();
      await expect(svc.assertCanRaiseQuota("acc", FQDN, -5 * MB)).resolves.toBeUndefined();
    });

    it("refuses a raise beyond the granted quota", async () => {
      delegations.findOne.mockResolvedValue(entity<DomainDelegation>({ accountId: "acc", quotaMb: 100, baseBytes: "0" }));
      recipients.createQueryBuilder.mockImplementation(() => qbSum(40 * MB));
      const e = await rejection(svc.assertCanRaiseQuota("acc", FQDN, 61 * MB));
      expect((e as ApiError).getResponse()).toMatchObject({ code: "delegations.reserveExceeded" });
    });
  });

  describe("listForDomain grantable visuals", () => {
    it("exposes the live grantable max globally and per row, own promise excluded", async () => {
      recipients.createQueryBuilder.mockImplementation(() => qbSum(0));
      recipients.count.mockResolvedValue(0);
      aliases.count.mockResolvedValue(0);
      accounts.findOne.mockResolvedValue(entity<Account>({ id: "a", email: "a@x.io" }));
      delegations.find.mockResolvedValue([entity<DomainDelegation>({ accountId: "a", quotaMb: 100 })]);
      invitations.find.mockResolvedValue([entity<AccountInvitation>({ id: 5, email: null, delegationQuotaMb: 200, expiresAt: null })]);
      const res = await svc.listForDomain(1);
      expect(res.grantableMb).toBe(700);
      expect(res.delegations[0]?.grantableMb).toBe(800);
      expect(res.pendingInvitations[0]?.grantableMb).toBe(900);
    });

    it("reports null on an unlimited domain", async () => {
      domains.findOne.mockResolvedValue(entity<VirtualDomain>({ id: 1, domain: FQDN, ownerId: "owner", quota: "0" }));
      delegations.find.mockResolvedValue([]);
      invitations.find.mockResolvedValue([]);
      const res = await svc.listForDomain(1);
      expect(res.grantableMb).toBeNull();
    });
  });

  describe("revokeInvitation", () => {
    it("404s on an unknown or accepted invitation", async () => {
      invitations.findOne.mockResolvedValue(null);
      await expect(svc.revokeInvitation(1, 9)).rejects.toBeInstanceOf(NotFoundException);
      invitations.findOne.mockResolvedValue(entity<AccountInvitation>({ id: 9, acceptedAt: new Date() }));
      await expect(svc.revokeInvitation(1, 9)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("expires a pending invitation on the spot", async () => {
      const inv = entity<AccountInvitation>({ id: 9, acceptedAt: null, expiresAt: new Date(Date.now() + 1000) });
      invitations.findOne.mockResolvedValue(inv);
      await expect(svc.revokeInvitation(1, 9)).resolves.toEqual({ ok: true });
      expect((inv.expiresAt as Date).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("grantFromInvitation (acceptance)", () => {
    it("does nothing when the invitation staged no delegation", async () => {
      await svc.grantFromInvitation(entity<AccountInvitation>({ delegationDomainId: null, delegationQuotaMb: null }), "acc");
      expect(delegations.save).not.toHaveBeenCalled();
    });

    it("clamps the staged quota to what the domain can still commit, its own pending reserve excluded", async () => {
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(970 * MB)).mockReturnValueOnce(qbSum(0));
      delegations.find.mockResolvedValue([]);
      delegations.findOne.mockResolvedValue(null);
      invitations.find.mockResolvedValue([entity<AccountInvitation>({ id: 9, delegationQuotaMb: 100 })]);
      await svc.grantFromInvitation(
        entity<AccountInvitation>({
          id: 9,
          delegationDomainId: 1,
          delegationMaxRecipients: 5,
          delegationMaxAliases: null,
          delegationQuotaMb: 100,
          invitedBy: "admin",
        }),
        "acc"
      );
      expect(delegations.save).toHaveBeenCalledWith(expect.objectContaining({ quotaMb: 30 }));
    });

    it("a claim adds to the existing grant, the addition clamped to what the domain can still commit", async () => {
      const existing = entity<DomainDelegation>({
        accountId: "acc",
        domainId: 1,
        maxRecipients: 5,
        maxAliases: 5,
        quotaMb: 800,
        baseRecipients: 0,
        baseAliases: 0,
        baseBytes: "0",
      });
      delegations.findOne.mockResolvedValue(existing);
      delegations.find.mockResolvedValue([existing]);
      await svc.grantFromInvitation(
        entity<AccountInvitation>({
          id: 9,
          delegationDomainId: 1,
          delegationMaxRecipients: 5,
          delegationMaxAliases: 5,
          delegationQuotaMb: 600,
          invitedBy: "admin",
        }),
        "acc"
      );
      expect(delegations.save).toHaveBeenCalledWith(expect.objectContaining({ maxRecipients: 10, maxAliases: 10, quotaMb: 1000 }));
    });
  });

  describe("setCaps / revoke", () => {
    it("404s when no delegation exists", async () => {
      delegations.findOne.mockResolvedValue(null);
      await expect(svc.setCaps(1, "acc", { maxRecipients: 5, maxAliases: 7, quotaMb: 100 })).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.revoke(1, "acc")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lowering to zero always passes (full restriction)", async () => {
      const row = entity<DomainDelegation>({ id: 3, accountId: "acc", domainId: 1, quotaMb: 100 });
      delegations.findOne.mockResolvedValue(row);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(500 * MB)).mockReturnValueOnce(qbSum(200 * MB));
      delegations.find.mockResolvedValue([row]);
      await svc.setCaps(1, "acc", { maxRecipients: 0, maxAliases: 0, quotaMb: 0 });
      expect(delegations.save).toHaveBeenCalledWith(expect.objectContaining({ maxRecipients: 0, maxAliases: 0, quotaMb: 0 }));
    });

    it("revoke removes the row and keeps already created resources untouched", async () => {
      const row = entity<DomainDelegation>({ id: 3, accountId: "acc", domainId: 1 });
      delegations.findOne.mockResolvedValue(row);
      await expect(svc.revoke(1, "acc")).resolves.toEqual({ ok: true });
      expect(delegations.remove).toHaveBeenCalledWith(row);
      expect(recipients.delete).not.toHaveBeenCalled();
    });
  });

  describe("delegate creation checks", () => {
    it("403s without a delegation", async () => {
      delegations.findOne.mockResolvedValue(null);
      const e = await rejection(svc.assertCanCreateRecipient("acc", 1, MB));
      expect((e as ApiError).getStatus()).toBe(403);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "delegations.noDelegation" });
    });

    it("400s at the recipient cap, and an unlimited cap (null) never blocks", async () => {
      delegations.findOne.mockResolvedValue(entity<DomainDelegation>({ maxRecipients: 2, quotaMb: 100 }));
      recipients.count.mockResolvedValue(2);
      const e = await rejection(svc.assertCanCreateRecipient("acc", 1, MB));
      expect((e as ApiError).getResponse()).toMatchObject({ code: "delegations.recipientCapReached", params: { max: 2 } });

      delegations.findOne.mockResolvedValue(entity<DomainDelegation>({ maxRecipients: null, quotaMb: 100 }));
      recipients.count.mockResolvedValue(9999);
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(0));
      await expect(svc.assertCanCreateRecipient("acc", 1, MB)).resolves.toBeTruthy();
    });

    it("400s when the new mailbox would exceed the granted quota", async () => {
      delegations.findOne.mockResolvedValue(entity<DomainDelegation>({ maxRecipients: null, quotaMb: 100 }));
      recipients.createQueryBuilder.mockReturnValueOnce(qbSum(90 * MB));
      const e = await rejection(svc.assertCanCreateRecipient("acc", 1, 20 * MB));
      expect((e as ApiError).getResponse()).toMatchObject({
        code: "delegations.reserveExceeded",
        params: { reservedMb: 100, usedMb: 90, requestedMb: 20 },
      });
    });

    it("alias cap: 400 at the cap, unlimited (null) never blocks", async () => {
      delegations.findOne.mockResolvedValue(entity<DomainDelegation>({ maxAliases: 3 }));
      aliases.count.mockResolvedValue(3);
      const e = await rejection(svc.assertCanCreateAlias("acc", 1));
      expect((e as ApiError).getResponse()).toMatchObject({ code: "delegations.aliasCapReached" });

      delegations.findOne.mockResolvedValue(entity<DomainDelegation>({ maxAliases: null }));
      await expect(svc.assertCanCreateAlias("acc", 1)).resolves.toBeTruthy();
    });
  });
});
