import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AccountsService } from "../../src/api/accounts/accounts.service";

// bcrypt is native + slow; the service only ever needs a deterministic hash.
vi.mock("bcrypt", () => ({ hash: vi.fn(async (pw: string) => `hashed:${pw}`) }));

// A chainable createQueryBuilder double: every builder method returns the same
// object, and the two terminal methods (getRawMany / getManyAndCount) are the
// ones a test stubs per case.
function makeQb() {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["leftJoin", "select", "addSelect", "orderBy", "andWhere", "where", "limit", "skip", "take"]) {
    qb[m] = vi.fn(() => qb);
  }
  qb.getRawMany = vi.fn();
  qb.getManyAndCount = vi.fn();
  return qb;
}

// One mock per constructor argument, in order. Repositories expose only the
// methods the service actually calls; each is a vi.fn so calls are assertable.
function makeMocks() {
  const accounts = {
    createQueryBuilder: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((x: Record<string, unknown>) => ({ ...x })),
    save: vi.fn(async (x: Record<string, unknown>) => ({ id: "generated-id", ...x })),
  };
  const profiles = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((x: Record<string, unknown>) => ({ ...x })),
    save: vi.fn(async (x: Record<string, unknown>) => x),
  };
  const invitations = {
    findOne: vi.fn(),
    create: vi.fn((x: Record<string, unknown>) => ({ ...x })),
    save: vi.fn(async (x: Record<string, unknown>) => x),
  };
  const groups = { findOne: vi.fn(), findBy: vi.fn() };
  const groupMembers = { find: vi.fn() };
  const mailer = { sendInvitation: vi.fn(async () => undefined) };
  const cpg = {
    guard: {
      findGroupGlobalPermissions: vi.fn(async () => []),
      findGroupDomainPermissions: vi.fn(async () => []),
      assignAccountToGroup: vi.fn(async () => undefined),
    },
  };
  const antiEscalation = { assertActingUserHolds: vi.fn(async () => undefined) };
  const geocoding = { geocodeCity: vi.fn(async () => ({ latitude: "48.8566", longitude: "2.3522" })) };
  const domains = { find: vi.fn(async () => []) };
  const virtualUsers = { find: vi.fn(async () => []) };
  return { accounts, profiles, invitations, groups, groupMembers, mailer, cpg, antiEscalation, geocoding, domains, virtualUsers };
}

describe("AccountsService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: AccountsService;

  beforeEach(() => {
    m = makeMocks();
    svc = new AccountsService(
      m.accounts as never,
      m.profiles as never,
      m.invitations as never,
      m.groups as never,
      m.groupMembers as never,
      m.mailer as never,
      m.cpg as never,
      m.antiEscalation as never,
      m.geocoding as never,
      m.domains as never,
      m.virtualUsers as never
    );
  });

  describe("listNames", () => {
    it("returns mapped rows and nulls a missing display name (base path)", async () => {
      const qb = makeQb();
      qb.getRawMany.mockResolvedValue([
        { id: "1", email: "a@b.com", displayName: "Alice" },
        { id: "2", email: "c@d.com", displayName: null },
      ]);
      m.accounts.createQueryBuilder.mockReturnValue(qb);

      const res = await svc.listNames();

      expect(res).toEqual([
        { id: "1", email: "a@b.com", displayName: "Alice" },
        { id: "2", email: "c@d.com", displayName: null },
      ]);
      expect(qb.leftJoin).toHaveBeenCalledTimes(1); // profile join only
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.limit).not.toHaveBeenCalled();
    });

    it("adds the not-in-group join, the search filter and the limit", async () => {
      const qb = makeQb();
      qb.getRawMany.mockResolvedValue([]);
      m.accounts.createQueryBuilder.mockReturnValue(qb);

      await svc.listNames({ notInGroup: "g-1", search: "bob", limit: 10 });

      expect(qb.leftJoin).toHaveBeenCalledTimes(2); // profile + group_members
      expect(qb.andWhere).toHaveBeenCalledWith("gm.id IS NULL");
      expect(qb.andWhere).toHaveBeenCalledWith("(a.email LIKE :s OR p.display_name LIKE :s)", { s: "%bob%" });
      expect(qb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe("list", () => {
    it("returns the enriched full list when no limit (legacy path)", async () => {
      m.accounts.find.mockResolvedValue([
        { id: "a1", email: "a@b.com", isRoot: 1, enabled: 1, lastLogin: null, createdAt: null },
      ]);
      m.groupMembers.find.mockResolvedValue([{ accountId: "a1", groupId: "g1" }]);
      m.profiles.find.mockResolvedValue([{ accountId: "a1", displayName: "Alice" }]);
      m.groups.findBy.mockResolvedValue([{ id: "g1", name: "Admins" }]);

      const res = await svc.list({ offset: 0, sortDir: "desc" } as never);

      expect(m.accounts.find).toHaveBeenCalledWith({ order: { email: "ASC" } });
      expect(res).toEqual([
        {
          id: "a1",
          email: "a@b.com",
          displayName: "Alice",
          isRoot: true,
          enabled: true,
          lastLogin: null,
          createdAt: null,
          groups: [{ id: "g1", name: "Admins" }],
        },
      ]);
    });

    it("paginates, searches and sorts on a whitelisted column", async () => {
      const qb = makeQb();
      qb.getManyAndCount.mockResolvedValue([[{ id: "a1", email: "a@b.com", isRoot: 0, enabled: 0 }], 1]);
      m.accounts.createQueryBuilder.mockReturnValue(qb);
      m.groupMembers.find.mockResolvedValue([]);
      m.profiles.find.mockResolvedValue([]);

      const res = await svc.list({ limit: 10, offset: 0, search: "x", sortBy: "email", sortDir: "asc" } as never);

      expect(qb.andWhere).toHaveBeenCalledWith("(a.email LIKE :s OR p.display_name LIKE :s)", { s: "%x%" });
      expect(qb.orderBy).toHaveBeenCalledWith("a.email", "ASC");
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({ id: "a1", displayName: null, groups: [] });
    });

    it("falls back to createdAt DESC on an unknown sortBy and no search", async () => {
      const qb = makeQb();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      m.accounts.createQueryBuilder.mockReturnValue(qb);

      const res = await svc.list({ limit: 25, offset: 0, sortBy: "bogus", sortDir: "desc" } as never);

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith("a.createdAt", "DESC");
      expect(res).toEqual({ items: [], total: 0 });
    });
  });

  describe("enrichWithGroups (via list)", () => {
    it("short-circuits repositories when there are no accounts", async () => {
      m.accounts.find.mockResolvedValue([]);

      const res = await svc.list({ offset: 0, sortDir: "desc" } as never);

      expect(res).toEqual([]);
      expect(m.groupMembers.find).not.toHaveBeenCalled();
      expect(m.profiles.find).not.toHaveBeenCalled();
      expect(m.groups.findBy).not.toHaveBeenCalled();
    });

    it("names an unresolved group '' and defaults absent members/profiles", async () => {
      m.accounts.find.mockResolvedValue([
        { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null },
        { id: "a2", email: "c@d.com", isRoot: 0, enabled: 0, lastLogin: null, createdAt: null },
      ]);
      // a1 is in g1 (resolved) and g2 (not returned by findBy -> "")
      m.groupMembers.find.mockResolvedValue([
        { accountId: "a1", groupId: "g1" },
        { accountId: "a1", groupId: "g2" },
      ]);
      m.profiles.find.mockResolvedValue([]); // no display names
      m.groups.findBy.mockResolvedValue([{ id: "g1", name: "Admins" }]);

      const res = (await svc.list({ offset: 0, sortDir: "desc" } as never)) as Array<Record<string, unknown>>;

      expect(res[0].groups).toEqual([
        { id: "g1", name: "Admins" },
        { id: "g2", name: "" },
      ]);
      expect(res[0].displayName).toBeNull();
      expect(res[1].groups).toEqual([]); // a2 has no membership
    });
  });

  describe("getById", () => {
    it("throws NotFound when the account is absent", async () => {
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.getById("x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("maps profile fields and the account's groups", async () => {
      m.accounts.findOne.mockResolvedValue({
        id: "a1",
        email: "a@b.com",
        isRoot: 1,
        enabled: 1,
        lastLogin: null,
        createdAt: null,
      });
      m.profiles.findOne.mockResolvedValue({ displayName: "Alice", avatarUrl: "u", phone: "p", city: "Paris" });
      m.groupMembers.find.mockResolvedValue([{ accountId: "a1", groupId: "g1" }]);
      m.groups.findBy.mockResolvedValue([{ id: "g1", name: "Admins" }]);

      const res = await svc.getById("a1");

      expect(res).toMatchObject({
        id: "a1",
        email: "a@b.com",
        displayName: "Alice",
        avatarUrl: "u",
        phone: "p",
        city: "Paris",
        isRoot: true,
        enabled: true,
        groups: [{ id: "g1", name: "Admins" }],
      });
    });

    it("nulls every optional field with no profile and returns no groups", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1", email: "a@b.com", isRoot: 0, enabled: 0, lastLogin: null, createdAt: null });
      m.profiles.findOne.mockResolvedValue(null);
      m.groupMembers.find.mockResolvedValue([]); // accountGroups short-circuit

      const res = await svc.getById("a1");

      expect(res).toMatchObject({ displayName: null, avatarUrl: null, phone: null, isRoot: false, enabled: false, groups: [] });
      expect(m.groups.findBy).not.toHaveBeenCalled();
    });
  });

  describe("updateAccount", () => {
    it("throws NotFound when the account is absent", async () => {
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.updateAccount("x", { email: "a@b.com" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects a clashing email with 409 and never saves", async () => {
      m.accounts.findOne.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "email" in where ? { id: "other", email: "new@x.com" } : { id: "a1", email: "old@x.com" }
      );
      await expect(svc.updateAccount("a1", { email: "new@x.com" })).rejects.toBeInstanceOf(ConflictException);
      expect(m.accounts.save).not.toHaveBeenCalled();
    });

    it("changes the email when the new one is free", async () => {
      const account = { id: "a1", email: "old@x.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        "email" in where ? null : account
      );
      m.profiles.findOne.mockResolvedValue(null);
      m.groupMembers.find.mockResolvedValue([]);

      const res = await svc.updateAccount("a1", { email: "new@x.com" });

      expect(m.accounts.save).toHaveBeenCalledWith(expect.objectContaining({ email: "new@x.com" }));
      expect(res.email).toBe("new@x.com");
    });

    it("refuses to disable a root account with 400", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1", email: "root@x.com", isRoot: 1, enabled: 1 });
      await expect(svc.updateAccount("a1", { enabled: false })).rejects.toBeInstanceOf(BadRequestException);
      expect(m.accounts.save).not.toHaveBeenCalled();
    });

    it("toggles enabled and updates an existing profile display name", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 0, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      const profile = { accountId: "a1", displayName: "old" };
      m.profiles.findOne.mockResolvedValue(profile);
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", { enabled: true, displayName: "New" });

      expect(m.accounts.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: 1 }));
      expect(m.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ displayName: "New" }));
      expect(m.profiles.create).not.toHaveBeenCalled();
    });

    it("disables a non-root account (enabled -> 0)", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue(null);
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", { enabled: false });

      expect(m.accounts.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: 0 }));
    });

    it("creates a profile when none exists to set the display name", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue(null);
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", { displayName: "Fresh" });

      expect(m.profiles.create).toHaveBeenCalledWith({ accountId: "a1" });
      expect(m.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ accountId: "a1", displayName: "Fresh" }));
    });

    it("persists every profile field and geocodes when the city is set", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue({ accountId: "a1" });
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", {
        avatarUrl: "https://x/a.png",
        phone: "+331",
        addressLine: "10 rue",
        addressComplement: "Apt 4",
        city: "Paris",
        postalCode: "75002",
        country: "France",
      });

      expect(m.geocoding.geocodeCity).toHaveBeenCalledWith("Paris", "France");
      expect(m.profiles.save).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarUrl: "https://x/a.png",
          phone: "+331",
          addressLine: "10 rue",
          addressComplement: "Apt 4",
          city: "Paris",
          postalCode: "75002",
          country: "France",
          latitude: "48.8566",
          longitude: "2.3522",
        })
      );
    });

    it("clears the coordinates when the city is cleared", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue({ accountId: "a1", city: "Paris", latitude: "1", longitude: "2" });
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", { city: null });

      expect(m.geocoding.geocodeCity).not.toHaveBeenCalled();
      expect(m.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ city: null, latitude: null, longitude: null }));
    });

    it("does not geocode when only non-address profile fields change", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue({ accountId: "a1" });
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", { phone: "+331" });

      expect(m.geocoding.geocodeCity).not.toHaveBeenCalled();
      expect(m.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ phone: "+331" }));
    });

    it("never touches the profile when no profile field is provided", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue(null);
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", { enabled: false });

      expect(m.profiles.save).not.toHaveBeenCalled();
      expect(m.profiles.create).not.toHaveBeenCalled();
    });
  });

  describe("getOverview", () => {
    it("throws NotFound when the account is absent (via getById)", async () => {
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.getOverview("x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns the account with the domains and recipients it owns", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue(null);
      m.groupMembers.find.mockResolvedValue([]);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com", active: 1, quota: "0" }]);
      m.virtualUsers.find.mockResolvedValue([{ id: 9, email: "j@ex.com", domain: "ex.com", active: 0, quota: "100" }]);

      const res = await svc.getOverview("a1");

      expect(m.domains.find).toHaveBeenCalledWith({ where: { ownerId: "a1" }, order: { domain: "ASC" } });
      expect(m.virtualUsers.find).toHaveBeenCalledWith({ where: { ownerId: "a1" }, order: { email: "ASC" } });
      expect(res.account.id).toBe("a1");
      expect(res.domains).toEqual([{ id: 5, domain: "ex.com", active: true, quota: "0" }]);
      expect(res.recipients).toEqual([{ id: 9, email: "j@ex.com", domain: "ex.com", active: false, quota: "100" }]);
    });
  });

  describe("revokeAccount", () => {
    it("throws NotFound when absent", async () => {
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.revokeAccount("x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to revoke a root account with 400", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1", isRoot: 1, enabled: 1 });
      await expect(svc.revokeAccount("a1")).rejects.toBeInstanceOf(BadRequestException);
      expect(m.accounts.save).not.toHaveBeenCalled();
    });

    it("disables the account and returns ok", async () => {
      const account = { id: "a1", isRoot: 0, enabled: 1 };
      m.accounts.findOne.mockResolvedValue(account);
      const res = await svc.revokeAccount("a1");
      expect(m.accounts.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: 0 }));
      expect(res).toEqual({ ok: true });
    });
  });

  describe("sendInvitation", () => {
    const actor = { id: "inviter-id", isRoot: false };

    it("falls back to the default group, saves the invite and mails the link", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.groups.findOne.mockResolvedValue({ id: "def", name: "Default" });

      const res = await svc.sendInvitation(actor, { email: "new@x.com", groupId: null });

      expect(m.groups.findOne).toHaveBeenCalledWith({ where: { isDefault: 1 } });
      expect(m.invitations.save).toHaveBeenCalledTimes(1);
      expect(m.invitations.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "new@x.com", invitedBy: "inviter-id", groupId: "def" })
      );
      expect(m.mailer.sendInvitation).toHaveBeenCalledWith("new@x.com", expect.stringContaining("/invite/"), "Default");
      expect(res).toEqual({ ok: true });
    });

    it("invalidates a still-valid previous invitation for the same email", async () => {
      const existing = { id: 1, email: "new@x.com", expiresAt: new Date(Date.now() + 3600_000) };
      m.invitations.findOne.mockResolvedValue(existing);
      m.groups.findOne.mockResolvedValue(null); // no default group

      await svc.sendInvitation(actor, { email: "new@x.com", groupId: null });

      expect(m.invitations.save).toHaveBeenCalledWith(existing); // expiry pushed to now
      expect(existing.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(m.invitations.save).toHaveBeenCalledTimes(2); // invalidation + new invite
      expect(m.mailer.sendInvitation).toHaveBeenCalledWith("new@x.com", expect.any(String), null);
    });

    it("leaves an already-expired previous invitation untouched", async () => {
      m.invitations.findOne.mockResolvedValue({ id: 1, email: "new@x.com", expiresAt: new Date(Date.now() - 3600_000) });
      m.groups.findOne.mockResolvedValue({ id: "def", name: "Default" });

      await svc.sendInvitation(actor, { email: "new@x.com", groupId: null });

      expect(m.invitations.save).toHaveBeenCalledTimes(1); // only the new invite
    });

    it("checks anti-escalation for an explicitly chosen group", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.groups.findOne.mockResolvedValue({ id: "g-admin", name: "Admins" });
      m.cpg.guard.findGroupGlobalPermissions.mockResolvedValue([{ resource: "accounts", action: "access" }]);
      m.cpg.guard.findGroupDomainPermissions.mockResolvedValue([{ domainId: 1, resource: "domain", action: "access" }]);

      await svc.sendInvitation(actor, { email: "new@x.com", groupId: "g-admin" });

      expect(m.groups.findOne).toHaveBeenCalledWith({ where: { id: "g-admin" } });
      expect(m.antiEscalation.assertActingUserHolds).toHaveBeenCalledWith(
        actor,
        [{ resource: "accounts", action: "access" }],
        [{ domainId: 1, resource: "domain", action: "access" }]
      );
      expect(m.invitations.create).toHaveBeenCalledWith(expect.objectContaining({ groupId: "g-admin" }));
    });

    it("throws NotFound when the chosen group does not exist", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.groups.findOne.mockResolvedValue(null);
      await expect(svc.sendInvitation(actor, { email: "new@x.com", groupId: "ghost" })).rejects.toBeInstanceOf(NotFoundException);
      expect(m.invitations.save).not.toHaveBeenCalled();
    });

    it("propagates the anti-escalation refusal before any invite is created", async () => {
      m.invitations.findOne.mockResolvedValue(null);
      m.groups.findOne.mockResolvedValue({ id: "g-admin", name: "Admins" });
      m.antiEscalation.assertActingUserHolds.mockRejectedValue(new Error("escalation"));
      await expect(svc.sendInvitation(actor, { email: "new@x.com", groupId: "g-admin" })).rejects.toThrow("escalation");
      expect(m.invitations.save).not.toHaveBeenCalled();
      expect(m.mailer.sendInvitation).not.toHaveBeenCalled();
    });

    it("honours a configured MANAGER_UI_URL and strips its trailing slash", async () => {
      const prev = process.env.MANAGER_UI_URL;
      process.env.MANAGER_UI_URL = "http://ui.test/";
      try {
        m.invitations.findOne.mockResolvedValue(null);
        m.groups.findOne.mockResolvedValue({ id: "def", name: "Default" });
        await svc.sendInvitation(actor, { email: "new@x.com", groupId: null });
        const link = m.mailer.sendInvitation.mock.calls.at(-1)![1] as string;
        expect(link).toMatch(/^http:\/\/ui\.test\/invite\/[a-f0-9]+$/);
      } finally {
        if (prev === undefined) delete process.env.MANAGER_UI_URL;
        else process.env.MANAGER_UI_URL = prev;
      }
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

    it("returns email/expiry and a null group name when ungrouped", async () => {
      const expiresAt = new Date(Date.now() + 10_000);
      m.invitations.findOne.mockResolvedValue({ email: "x@y.com", groupId: null, acceptedAt: null, expiresAt });
      const res = await svc.getInvitation("t");
      expect(res).toEqual({ email: "x@y.com", groupName: null, expiresAt });
      expect(m.groups.findOne).not.toHaveBeenCalled();
    });

    it("resolves the group name when grouped", async () => {
      m.invitations.findOne.mockResolvedValue({
        email: "x@y.com",
        groupId: "g1",
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
      });
      m.groups.findOne.mockResolvedValue({ id: "g1", name: "Admins" });
      const res = await svc.getInvitation("t");
      expect(res.groupName).toBe("Admins");
    });

    it("nulls the group name when the referenced group is gone", async () => {
      m.invitations.findOne.mockResolvedValue({
        email: "x@y.com",
        groupId: "g1",
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
      });
      m.groups.findOne.mockResolvedValue(null);
      const res = await svc.getInvitation("t");
      expect(res.groupName).toBeNull();
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
  });
});
