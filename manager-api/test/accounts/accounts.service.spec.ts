import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AccountsService } from "../../src/api/accounts/crud/crud.service";
import { Account } from "../../src/core/entities/account.entity";
import { AccountProfile } from "../../src/core/entities/account-profile.entity";
import { Group } from "../../src/core/entities/group.entity";
import { GroupMember } from "../../src/core/entities/group-member.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import type { GeocodingService } from "../../src/core/geocoding/geocoding.service";
import { providerMock, qbMock, repoMock } from "../helpers/mocks";

// One typed double per constructor argument, in order. The repositories slot
// straight into the service constructor (no `as never`), so a wrong repo type or
// a DTO that does not match the business shape now fails `tsc`. The invitation
// lifecycle lives in AccountsInvitationsService (its own spec), so its
// collaborators are not wired here.
function makeMocks() {
  return {
    accounts: repoMock<Account>(),
    profiles: repoMock<AccountProfile>(),
    groups: repoMock<Group>(),
    groupMembers: repoMock<GroupMember>(),
    geocoding: providerMock<GeocodingService>({
      geocodeCity: vi.fn(async () => ({ latitude: "48.8566", longitude: "2.3522" })),
    }),
    domains: repoMock<VirtualDomain>(),
    virtualUsers: repoMock<VirtualUser>(),
  };
}

describe("AccountsService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: AccountsService;

  beforeEach(() => {
    m = makeMocks();
    svc = new AccountsService(m.accounts, m.profiles, m.groups, m.groupMembers, m.geocoding, m.domains, m.virtualUsers);
  });

  describe("listNames", () => {
    it("returns mapped rows and nulls a missing display name (base path)", async () => {
      const qb = qbMock<Account>();
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
      const qb = qbMock<Account>();
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

      const res = await svc.list({ offset: 0, sortDir: "desc" });

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
      const qb = qbMock<Account>();
      qb.getManyAndCount.mockResolvedValue([[{ id: "a1", email: "a@b.com", isRoot: 0, enabled: 0 }], 1]);
      m.accounts.createQueryBuilder.mockReturnValue(qb);
      m.groupMembers.find.mockResolvedValue([]);
      m.profiles.find.mockResolvedValue([]);

      const res = await svc.list({ limit: 10, offset: 0, search: "x", sortBy: "email", sortDir: "asc" });

      expect(qb.andWhere).toHaveBeenCalledWith("(a.email LIKE :s OR p.display_name LIKE :s)", { s: "%x%" });
      expect(qb.orderBy).toHaveBeenCalledWith("a.email", "ASC");
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      // `list` returns a paginated shape only when a limit is given; narrow it.
      if (Array.isArray(res)) throw new Error("expected a paginated result");
      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({ id: "a1", displayName: null, groups: [] });
    });

    it("falls back to createdAt DESC on an unknown sortBy and no search", async () => {
      const qb = qbMock<Account>();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      m.accounts.createQueryBuilder.mockReturnValue(qb);

      const res = await svc.list({ limit: 25, offset: 0, sortBy: "bogus", sortDir: "desc" });

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith("a.createdAt", "DESC");
      expect(res).toEqual({ items: [], total: 0 });
    });
  });

  describe("enrichWithGroups (via list)", () => {
    it("short-circuits repositories when there are no accounts", async () => {
      m.accounts.find.mockResolvedValue([]);

      const res = await svc.list({ offset: 0, sortDir: "desc" });

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

      const res = await svc.list({ offset: 0, sortDir: "desc" });
      if (!Array.isArray(res)) throw new Error("expected the unpaginated list");

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
      m.accounts.findOne.mockResolvedValue({
        id: "a1",
        email: "a@b.com",
        isRoot: 0,
        enabled: 0,
        lastLogin: null,
        createdAt: null,
      });
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
});
