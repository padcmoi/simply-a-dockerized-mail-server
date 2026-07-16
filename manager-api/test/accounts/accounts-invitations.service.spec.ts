import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AccountsInvitationsService } from "../../src/api/accounts/invitations/invitations.service";
import { AccountInvitation } from "../../src/core/entities/account-invitation.entity";
import { Account } from "../../src/core/entities/account.entity";
import { AccountProfile } from "../../src/core/entities/account-profile.entity";
import { Group } from "../../src/core/entities/group.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import type { AntiEscalationService } from "../../src/core/acl/anti-escalation.service";
import type { MailerService } from "../../src/core/mailer/mailer.service";
import { cpgMock, providerMock, repoMock } from "../helpers/mocks";

// bcrypt is native + slow; the service only ever needs a deterministic hash.
vi.mock("bcrypt", () => ({ hash: vi.fn(async (pw: string) => `hashed:${pw}`) }));

// One typed double per constructor argument, in order. Every dependency slots
// straight into the service constructor (no `as never`), so a wrong repository
// or a DTO that violates the business shape now fails `tsc`.
function makeMocks() {
  const accounts = repoMock<Account>();
  // acceptInvitation reads the id off the freshly saved account.
  accounts.save.mockImplementation(async (x: object) => ({ id: "generated-id", ...x }));
  return {
    invitations: repoMock<AccountInvitation>(),
    accounts,
    profiles: repoMock<AccountProfile>(),
    groups: repoMock<Group>(),
    domains: repoMock<VirtualDomain>(),
    mailer: providerMock<MailerService>({ sendInvitation: vi.fn(async () => undefined) }),
    cpg: cpgMock(),
    antiEscalation: providerMock<AntiEscalationService>({ assertActingUserHolds: vi.fn(async () => undefined) }),
  };
}

describe("AccountsInvitationsService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: AccountsInvitationsService;

  beforeEach(() => {
    m = makeMocks();
    svc = new AccountsInvitationsService(
      m.invitations,
      m.accounts,
      m.profiles,
      m.groups,
      m.domains,
      m.mailer,
      m.cpg,
      m.antiEscalation
    );
  });

  describe("sendInvitation", () => {
    const actor = { id: "inviter-id", isRoot: false };
    const BASE = "https://mail.host.test";

    it("requires a domain, saves the invite and mails the link from that domain", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 1, domain: "example.com" });

      const res = await svc.sendInvitation(actor, { email: "new@x.com", domainId: 1, groupIds: [], makeOwner: false, useDomainGroup: false }, BASE);

      expect(m.domains.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(m.invitations.save).toHaveBeenCalledTimes(1);
      expect(m.invitations.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "new@x.com", invitedBy: "inviter-id", groupId: null, groupIds: "[]" })
      );
      expect(m.mailer.sendInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ to: "new@x.com", fromDomain: "example.com", groupNames: [] })
      );
      expect(res).toEqual({ ok: true });
    });

    it("throws NotFound when the domain does not exist and saves nothing", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue(null);
      await expect(
        svc.sendInvitation(actor, { email: "new@x.com", domainId: 99, groupIds: [], makeOwner: false, useDomainGroup: false }, BASE)
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(m.invitations.save).not.toHaveBeenCalled();
      expect(m.mailer.sendInvitation).not.toHaveBeenCalled();
    });

    it("invalidates a still-valid previous invitation for the same email", async () => {
      const existing = { id: 1, email: "new@x.com", expiresAt: new Date(Date.now() + 3600_000) };
      m.invitations.findOne.mockResolvedValue(existing);
      m.domains.findOne.mockResolvedValue({ id: 1, domain: "example.com" });

      await svc.sendInvitation(actor, { email: "new@x.com", domainId: 1, groupIds: [], makeOwner: false, useDomainGroup: false }, BASE);

      expect(m.invitations.save).toHaveBeenCalledWith(existing);
      expect(existing.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(m.invitations.save).toHaveBeenCalledTimes(2);
    });

    it("leaves an already-expired previous invitation untouched", async () => {
      m.invitations.findOne.mockResolvedValue({ id: 1, email: "new@x.com", expiresAt: new Date(Date.now() - 3600_000) });
      m.domains.findOne.mockResolvedValue({ id: 1, domain: "example.com" });
      await svc.sendInvitation(actor, { email: "new@x.com", domainId: 1, groupIds: [], makeOwner: false, useDomainGroup: false }, BASE);
      expect(m.invitations.save).toHaveBeenCalledTimes(1);
    });

    it("checks anti-escalation for each chosen group and stores them all", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 1, domain: "example.com" });
      m.groups.findBy.mockResolvedValue([
        { id: "g1", name: "Admins" },
        { id: "g2", name: "Support" },
      ]);
      m.cpg.guard.findGroupGlobalPermissions.mockResolvedValue([{ resource: "accounts", action: "access" }]);
      m.cpg.guard.findGroupDomainPermissions.mockResolvedValue([]);

      await svc.sendInvitation(actor, { email: "new@x.com", domainId: 1, groupIds: ["g1", "g2"], makeOwner: false, useDomainGroup: false }, BASE);

      expect(m.antiEscalation.assertActingUserHolds).toHaveBeenCalledTimes(2);
      expect(m.invitations.create).toHaveBeenCalledWith(expect.objectContaining({ groupIds: JSON.stringify(["g1", "g2"]) }));
    });

    it("throws NotFound when a chosen group does not exist", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 1, domain: "example.com" });
      m.groups.findBy.mockResolvedValue([{ id: "g1", name: "Admins" }]);
      await expect(
        svc.sendInvitation(actor, { email: "new@x.com", domainId: 1, groupIds: ["g1", "ghost"], makeOwner: false, useDomainGroup: false }, BASE)
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(m.invitations.save).not.toHaveBeenCalled();
    });

    it("propagates the anti-escalation refusal before any invite is created", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 1, domain: "example.com" });
      m.groups.findBy.mockResolvedValue([{ id: "g1", name: "Admins" }]);
      m.antiEscalation.assertActingUserHolds.mockRejectedValue(new Error("escalation"));
      await expect(
        svc.sendInvitation(actor, { email: "new@x.com", domainId: 1, groupIds: ["g1"], makeOwner: false, useDomainGroup: false }, BASE)
      ).rejects.toThrow("escalation");
      expect(m.invitations.save).not.toHaveBeenCalled();
      expect(m.mailer.sendInvitation).not.toHaveBeenCalled();
    });

    it("builds the invite link from the given base url", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 1, domain: "example.com" });
      await svc.sendInvitation(actor, { email: "new@x.com", domainId: 1, groupIds: [], makeOwner: false, useDomainGroup: false }, "https://ui.test/");
      const arg = m.mailer.sendInvitation.mock.calls.at(-1)![0] as { link: string };
      expect(arg.link).toMatch(/^https:\/\/ui\.test\/invite\/[a-f0-9]+$/);
    });

    it("stores the owner-domain pointer without an ACL check for a root", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 7, domain: "example.com", ownerId: null });
      await svc.sendInvitation(
        { id: "inviter-id", isRoot: true },
        { email: "new@x.com", domainId: 7, groupIds: [], makeOwner: true, useDomainGroup: false },
        BASE
      );
      expect(m.cpg.guard.assertOne.global).not.toHaveBeenCalled();
      expect(m.invitations.create).toHaveBeenCalledWith(expect.objectContaining({ ownerDomainId: 7 }));
    });

    it("requires both the accounts and domains ownership actions from a non-root inviter", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 7, domain: "example.com", ownerId: null });
      await svc.sendInvitation(actor, { email: "new@x.com", domainId: 7, groupIds: [], makeOwner: true, useDomainGroup: false }, BASE);
      expect(m.cpg.guard.assertOne.global).toHaveBeenCalledWith("inviter-id", "accounts", { acrud: ["set-domain-owner"] });
      expect(m.cpg.guard.assertOne.global).toHaveBeenCalledWith("inviter-id", "domains", {
        acrud: ["transfer-domain-ownership"],
      });
      expect(m.cpg.guard.assertOne.global).toHaveBeenCalledWith("inviter-id", "domain_owner_elevated", {
        acrud: ["transfer-domain-ownership"],
      });
      expect(m.invitations.create).toHaveBeenCalledWith(expect.objectContaining({ ownerDomainId: 7 }));
    });

    it("propagates the forbidden error and saves nothing when an ownership action is missing", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 7, domain: "example.com", ownerId: null });
      m.cpg.guard.assertOne.global.mockRejectedValueOnce(new ForbiddenException("nope"));
      await expect(
        svc.sendInvitation(actor, { email: "new@x.com", domainId: 7, groupIds: [], makeOwner: true, useDomainGroup: false }, BASE)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.invitations.save).not.toHaveBeenCalled();
      expect(m.mailer.sendInvitation).not.toHaveBeenCalled();
    });

    it("never checks the ownership action when makeOwner is false", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.domains.findOne.mockResolvedValue({ id: 7, domain: "example.com", ownerId: null });
      await svc.sendInvitation(actor, { email: "new@x.com", domainId: 7, groupIds: [], makeOwner: false, useDomainGroup: false }, BASE);
      expect(m.cpg.guard.assertOne.global).not.toHaveBeenCalled();
      expect(m.invitations.create).toHaveBeenCalledWith(expect.objectContaining({ ownerDomainId: null }));
    });
  });

  describe("getInvitation", () => {
    it("throws NotFound for an unknown token", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      await expect(svc.getInvitation("t")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 400 when already accepted", async () => {
      m.invitations.findOne.mockResolvedValue({ acceptedAt: new Date(), expiresAt: new Date(Date.now() + 1000) });
      await expect(svc.getInvitation("t")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws 400 when expired", async () => {
      m.invitations.findOne.mockResolvedValue({ acceptedAt: null, expiresAt: new Date(Date.now() - 1000) });
      await expect(svc.getInvitation("t")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("returns email/expiry and no groups when ungrouped", async () => {
      const expiresAt = new Date(Date.now() + 10_000);
      m.invitations.findOne.mockResolvedValue({ email: "x@y.com", groupId: null, groupIds: null, acceptedAt: null, expiresAt });
      const res = await svc.getInvitation("t");
      expect(res).toEqual({ email: "x@y.com", groups: [], expiresAt });
      expect(m.groups.findBy).not.toHaveBeenCalled();
    });

    it("resolves the group names when multiple groups are stored", async () => {
      m.invitations.findOne.mockResolvedValue({
        email: "x@y.com",
        groupId: null,
        groupIds: JSON.stringify(["g1", "g2"]),
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
      });
      m.groups.findBy.mockResolvedValue([
        { id: "g1", name: "Admins" },
        { id: "g2", name: "Support" },
      ]);
      const res = await svc.getInvitation("t");
      expect(res.groups).toEqual(["Admins", "Support"]);
    });

    it("falls back to the legacy single group_id", async () => {
      m.invitations.findOne.mockResolvedValue({
        email: "x@y.com",
        groupId: "g1",
        groupIds: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
      });
      m.groups.findBy.mockResolvedValue([{ id: "g1", name: "Admins" }]);
      const res = await svc.getInvitation("t");
      expect(res.groups).toEqual(["Admins"]);
    });
  });

  describe("acceptInvitation", () => {
    it("throws NotFound for an unknown token", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      await expect(svc.acceptInvitation("t", { password: "longenough" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 400 when already accepted", async () => {
      m.invitations.findOne.mockResolvedValue({ acceptedAt: new Date(), expiresAt: new Date(Date.now() + 1000) });
      await expect(svc.acceptInvitation("t", { password: "longenough" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws 400 when expired", async () => {
      m.invitations.findOne.mockResolvedValue({ acceptedAt: null, expiresAt: new Date(Date.now() - 1000) });
      await expect(svc.acceptInvitation("t", { password: "longenough" })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects when an account already owns the invited email (409)", async () => {
      m.invitations.findOne.mockResolvedValue({ email: "x@y.com", acceptedAt: null, expiresAt: new Date(Date.now() + 1000) });
      m.accounts.findOne.mockResolvedValue({ id: "existing" });
      await expect(svc.acceptInvitation("t", { password: "longenough" })).rejects.toBeInstanceOf(ConflictException);
      expect(m.accounts.save).not.toHaveBeenCalled();
    });

    it("creates the account + profile without a group and marks the invite used", async () => {
      const inv = { email: "x@y.com", groupId: null, acceptedAt: null, expiresAt: new Date(Date.now() + 1000) };
      m.invitations.findOne.mockResolvedValue(inv);
      m.accounts.findOne.mockResolvedValue(null);

      const res = await svc.acceptInvitation("t", { password: "longenough", displayName: "Jo" });

      expect(bcrypt.hash).toHaveBeenCalledWith("longenough", 12);
      expect(m.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "x@y.com", password: "hashed:longenough", isRoot: 0, enabled: 1 })
      );
      expect(m.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ accountId: "generated-id", displayName: "Jo" }));
      expect(m.cpg.guard.assignAccountToGroup).not.toHaveBeenCalled();
      expect(inv.acceptedAt).toBeInstanceOf(Date);
      expect(m.invitations.save).toHaveBeenCalledWith(inv);
      expect(res).toEqual({ ok: true, email: "x@y.com" });
    });

    it("assigns the invited group and defaults a missing display name to null", async () => {
      const inv = { email: "x@y.com", groupId: "g1", acceptedAt: null, expiresAt: new Date(Date.now() + 1000) };
      m.invitations.findOne.mockResolvedValue(inv);
      m.accounts.findOne.mockResolvedValue(null);

      await svc.acceptInvitation("t", { password: "longenough" });

      expect(m.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ displayName: null }));
      expect(m.cpg.guard.assignAccountToGroup).toHaveBeenCalledWith("generated-id", "g1");
    });

    it("also assigns the default group on top of the invited ones", async () => {
      const inv = {
        email: "x@y.com",
        groupId: null,
        groupIds: JSON.stringify(["g1"]),
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 1000),
      };
      m.invitations.findOne.mockResolvedValue(inv);
      m.accounts.findOne.mockResolvedValue(null);
      m.groups.findOne.mockResolvedValue({ id: "def", isDefault: 1 });

      await svc.acceptInvitation("t", { password: "longenough" });

      expect(m.cpg.guard.assignAccountToGroup).toHaveBeenCalledWith("generated-id", "g1");
      expect(m.cpg.guard.assignAccountToGroup).toHaveBeenCalledWith("generated-id", "def");
    });

    it("designates the new account as domain owner when owner_domain_id is set", async () => {
      const inv = {
        email: "x@y.com",
        groupId: null,
        groupIds: null,
        ownerDomainId: 9,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 1000),
      };
      m.invitations.findOne.mockResolvedValue(inv);
      m.accounts.findOne.mockResolvedValue(null);

      await svc.acceptInvitation("t", { password: "longenough" });

      expect(m.domains.update).toHaveBeenCalledWith(9, { ownerId: "generated-id" });
    });

    it("leaves domain ownership untouched when owner_domain_id is null", async () => {
      const inv = {
        email: "x@y.com",
        groupId: null,
        groupIds: null,
        ownerDomainId: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 1000),
      };
      m.invitations.findOne.mockResolvedValue(inv);
      m.accounts.findOne.mockResolvedValue(null);

      await svc.acceptInvitation("t", { password: "longenough" });

      expect(m.domains.update).not.toHaveBeenCalled();
    });
  });
});
