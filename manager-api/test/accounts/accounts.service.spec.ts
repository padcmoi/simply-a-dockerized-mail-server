import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, ConflictException, HttpStatus, NotFoundException } from "@nestjs/common";
import { AccountsService } from "../../src/api/accounts/crud/crud.service";
import { ApiError } from "../../src/core/common/api-error";
import { Account } from "../../src/core/entities/account.entity";
import { AccountProfile } from "../../src/core/entities/account-profile.entity";
import { Group } from "../../src/core/entities/group.entity";
import { GroupMember } from "../../src/core/entities/group-member.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
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
    aliases: repoMock<VirtualAlias>(),
  };
}

describe("AccountsService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: AccountsService;

  beforeEach(() => {
    m = makeMocks();
    svc = new AccountsService(
      m.accounts,
      m.profiles,
      m.groups,
      m.groupMembers,
      m.geocoding,
      m.domains,
      m.virtualUsers,
      m.aliases
    );
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
      expect(qb.andWhere).toHaveBeenCalledWith("(a.email LIKE :s OR CONCAT_WS(' ', p.first_name, p.last_name) LIKE :s)", {
        s: "%bob%",
      });
      expect(qb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe("list", () => {
    it("returns the enriched full list when no limit (legacy path)", async () => {
      m.accounts.find.mockResolvedValue([
        { id: "a1", email: "a@b.com", isRoot: 1, enabled: 1, lastLogin: null, createdAt: null },
      ]);
      m.groupMembers.find.mockResolvedValue([{ accountId: "a1", groupId: "g1" }]);
      m.profiles.find.mockResolvedValue([{ accountId: "a1", firstName: "Alice", lastName: "Martin" }]);
      m.groups.findBy.mockResolvedValue([{ id: "g1", name: "Admins" }]);

      const res = await svc.list({ offset: 0, sortDir: "desc" });

      expect(m.accounts.find).toHaveBeenCalledWith({ order: { email: "ASC" } });
      expect(res).toEqual([
        {
          id: "a1",
          email: "a@b.com",
          displayName: "Alice Martin",
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

      expect(qb.andWhere).toHaveBeenCalledWith("(a.email LIKE :s OR CONCAT_WS(' ', p.first_name, p.last_name) LIKE :s)", {
        s: "%x%",
      });
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
      m.profiles.findOne.mockResolvedValue({ firstName: "Alice", lastName: "Martin", avatarUrl: "u", phone: "p", city: "Paris" });
      m.groupMembers.find.mockResolvedValue([{ accountId: "a1", groupId: "g1" }]);
      m.groups.findBy.mockResolvedValue([{ id: "g1", name: "Admins" }]);

      const res = await svc.getById("a1");

      expect(res).toMatchObject({
        id: "a1",
        email: "a@b.com",
        displayName: "Alice Martin",
        firstName: "Alice",
        lastName: "Martin",
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

    it("toggles enabled and updates an existing profile name", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 0, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      const profile = { accountId: "a1", displayName: "old" };
      m.profiles.findOne.mockResolvedValue(profile);
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", { enabled: true, lastName: "New" });

      expect(m.accounts.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: 1 }));
      expect(m.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ lastName: "New" }));
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

    it("creates a profile when none exists to set the name", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue(null);
      m.groupMembers.find.mockResolvedValue([]);

      await svc.updateAccount("a1", { lastName: "Fresh" });

      expect(m.profiles.create).toHaveBeenCalledWith({ accountId: "a1" });
      expect(m.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ accountId: "a1", lastName: "Fresh" }));
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

    it("returns the account with the domains, recipients and aliases it owns", async () => {
      const account = { id: "a1", email: "a@b.com", isRoot: 0, enabled: 1, lastLogin: null, createdAt: null };
      m.accounts.findOne.mockResolvedValue(account);
      m.profiles.findOne.mockResolvedValue(null);
      m.groupMembers.find.mockResolvedValue([]);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com", active: 1, quota: "0" }]);
      m.virtualUsers.find.mockResolvedValue([{ id: 9, email: "j@ex.com", domain: "ex.com", active: 0, quota: "100" }]);
      m.aliases.find.mockResolvedValue([{ id: 4, source: "a@ex.com", destination: "j@ex.com", domain: "ex.com" }]);

      const res = await svc.getOverview("a1");

      expect(m.domains.find).toHaveBeenCalledWith({ where: { ownerId: "a1" }, order: { domain: "ASC" } });
      expect(m.virtualUsers.find).toHaveBeenCalledWith({ where: { ownerId: "a1" }, order: { email: "ASC" } });
      expect(m.aliases.find).toHaveBeenCalledWith({ where: { ownerId: "a1" }, order: { source: "ASC" } });
      expect(res.account.id).toBe("a1");
      expect(res.domains).toEqual([{ id: 5, domain: "ex.com", active: true, quota: "0" }]);
      expect(res.recipients).toEqual([{ id: 9, email: "j@ex.com", domain: "ex.com", active: false, quota: "100" }]);
      expect(res.aliases).toEqual([{ id: 4, source: "a@ex.com", destination: "j@ex.com", domain: "ex.com" }]);
    });
  });

  describe("deleteAccount", () => {
    it("throws NotFound when absent", async () => {
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.deleteAccount("x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to delete a root account with 400", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1", isRoot: 1, enabled: 1 });
      await expect(svc.deleteAccount("a1")).rejects.toBeInstanceOf(BadRequestException);
      expect(m.accounts.delete).not.toHaveBeenCalled();
    });

    it("hard-deletes the account and returns ok", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1", isRoot: 0, enabled: 1 });
      const res = await svc.deleteAccount("a1");
      expect(m.accounts.delete).toHaveBeenCalledWith({ id: "a1" });
      expect(m.accounts.save).not.toHaveBeenCalled();
      expect(res).toEqual({ ok: true });
    });
  });

  describe("ownedRecipients", () => {
    it("throws NotFound when the account is absent", async () => {
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.ownedRecipients("x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("resolves each recipient's domain id, null when the domain is gone", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.virtualUsers.find.mockResolvedValue([
        { id: 1, email: "a@ex.com", domain: "ex.com" },
        { id: 2, email: "b@gone.com", domain: "gone.com" },
      ]);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com" }]);

      const res = await svc.ownedRecipients("a1");

      expect(m.virtualUsers.find).toHaveBeenCalledWith({ where: { ownerId: "a1" }, order: { email: "ASC" } });
      expect(res).toEqual([
        { id: 1, email: "a@ex.com", domain: "ex.com", domainId: 5 },
        { id: 2, email: "b@gone.com", domain: "gone.com", domainId: null },
      ]);
    });

    it("skips the domain lookup when the account owns nothing", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.virtualUsers.find.mockResolvedValue([]);

      const res = await svc.ownedRecipients("a1");

      expect(res).toEqual([]);
      expect(m.domains.find).not.toHaveBeenCalled();
    });
  });

  describe("ownedAliases", () => {
    it("throws NotFound when the account is absent", async () => {
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.ownedAliases("x")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("resolves each alias's domain id from its domain name", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.aliases.find.mockResolvedValue([{ id: 3, source: "a@ex.com", destination: "b@ex.com", domain: "ex.com" }]);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com" }]);

      const res = await svc.ownedAliases("a1");

      expect(m.aliases.find).toHaveBeenCalledWith({ where: { ownerId: "a1" }, order: { source: "ASC" } });
      expect(res).toEqual([{ id: 3, source: "a@ex.com", destination: "b@ex.com", domain: "ex.com", domainId: 5 }]);
    });
  });

  describe("assignableRecipients", () => {
    it("lists the unassigned domains and a capped, searched page", async () => {
      const disc = qbMock<VirtualUser>();
      disc.getRawMany.mockResolvedValue([{ domain: "ex.com" }]);
      const page = qbMock<VirtualUser>();
      page.getMany.mockResolvedValue([{ id: 1, email: "free@ex.com", domain: "ex.com" }]);
      m.virtualUsers.createQueryBuilder.mockReturnValueOnce(disc).mockReturnValueOnce(page);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com" }]);

      const res = await svc.assignableRecipients(undefined, "free");

      expect(page.andWhere).toHaveBeenCalledWith("r.email LIKE :s", { s: "%free%" });
      expect(page.take).toHaveBeenCalledWith(25);
      expect(res.domains).toEqual([{ id: 5, domain: "ex.com" }]);
      expect(res.items).toEqual([{ id: 1, email: "free@ex.com", domain: "ex.com", domainId: 5 }]);
    });

    it("filters on the picked domain when it is assignable", async () => {
      const disc = qbMock<VirtualUser>();
      disc.getRawMany.mockResolvedValue([{ domain: "ex.com" }]);
      const page = qbMock<VirtualUser>();
      page.getMany.mockResolvedValue([]);
      m.virtualUsers.createQueryBuilder.mockReturnValueOnce(disc).mockReturnValueOnce(page);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com" }]);

      await svc.assignableRecipients(5);

      expect(page.andWhere).toHaveBeenCalledWith("r.domain = :dn", { dn: "ex.com" });
    });

    it("returns no items when the picked domain has none free", async () => {
      const disc = qbMock<VirtualUser>();
      disc.getRawMany.mockResolvedValue([{ domain: "ex.com" }]);
      const page = qbMock<VirtualUser>();
      m.virtualUsers.createQueryBuilder.mockReturnValueOnce(disc).mockReturnValueOnce(page);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com" }]);

      const res = await svc.assignableRecipients(999);

      expect(res).toEqual({ domains: [{ id: 5, domain: "ex.com" }], items: [] });
      expect(page.getMany).not.toHaveBeenCalled();
    });

    it("short-circuits the domain lookup when nothing is unassigned", async () => {
      const disc = qbMock<VirtualUser>();
      disc.getRawMany.mockResolvedValue([]);
      const page = qbMock<VirtualUser>();
      page.getMany.mockResolvedValue([]);
      m.virtualUsers.createQueryBuilder.mockReturnValueOnce(disc).mockReturnValueOnce(page);

      const res = await svc.assignableRecipients();

      expect(m.domains.find).not.toHaveBeenCalled();
      expect(res).toEqual({ domains: [], items: [] });
    });
  });

  describe("assignableAliases", () => {
    it("lists the unassigned alias domains and a searched page", async () => {
      const disc = qbMock<VirtualAlias>();
      disc.getRawMany.mockResolvedValue([{ domain: "ex.com" }]);
      const page = qbMock<VirtualAlias>();
      page.getMany.mockResolvedValue([{ id: 3, source: "a@ex.com", destination: "b@ex.com", domain: "ex.com" }]);
      m.aliases.createQueryBuilder.mockReturnValueOnce(disc).mockReturnValueOnce(page);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com" }]);

      const res = await svc.assignableAliases(5, "a@");

      expect(page.andWhere).toHaveBeenCalledWith("(a.source LIKE :s OR a.destination LIKE :s)", { s: "%a@%" });
      expect(res.items).toEqual([{ id: 3, source: "a@ex.com", destination: "b@ex.com", domain: "ex.com", domainId: 5 }]);
    });

    it("returns no items when the picked alias domain has none free", async () => {
      const disc = qbMock<VirtualAlias>();
      disc.getRawMany.mockResolvedValue([{ domain: "ex.com" }]);
      const page = qbMock<VirtualAlias>();
      m.aliases.createQueryBuilder.mockReturnValueOnce(disc).mockReturnValueOnce(page);
      m.domains.find.mockResolvedValue([{ id: 5, domain: "ex.com" }]);

      const res = await svc.assignableAliases(999);

      expect(res.items).toEqual([]);
      expect(page.getMany).not.toHaveBeenCalled();
    });
  });

  describe("attachRecipient", () => {
    it("throws NotFound when the account is absent", async () => {
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.attachRecipient("x", 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws NotFound when the recipient is absent", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.virtualUsers.findOne.mockResolvedValue(null);
      await expect(svc.attachRecipient("a1", 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("forbids assigning a postmaster mailbox", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.virtualUsers.findOne.mockResolvedValue({ id: 1, email: "postmaster@ex.com", ownerId: null });

      const err = await svc.attachRecipient("a1", 1).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(m.virtualUsers.save).not.toHaveBeenCalled();
    });

    it("rejects a recipient already assigned to someone", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.virtualUsers.findOne.mockResolvedValue({ id: 1, email: "a@ex.com", ownerId: "other" });

      const err = await svc.attachRecipient("a1", 1).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it("assigns a free recipient to the account", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      const recipient = { id: 1, email: "a@ex.com", ownerId: null };
      m.virtualUsers.findOne.mockResolvedValue(recipient);
      m.virtualUsers.save.mockResolvedValue({ ...recipient, ownerId: "a1" });

      await svc.attachRecipient("a1", 1);

      expect(m.virtualUsers.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, ownerId: "a1" }));
    });
  });

  describe("detachRecipient", () => {
    it("throws NotFound when the recipient is not owned by the account", async () => {
      m.virtualUsers.findOne.mockResolvedValue(null);
      await expect(svc.detachRecipient("a1", 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("clears the owner of a recipient the account owns", async () => {
      m.virtualUsers.findOne.mockResolvedValue({ id: 1, email: "a@ex.com", ownerId: "a1" });

      await svc.detachRecipient("a1", 1);

      expect(m.virtualUsers.findOne).toHaveBeenCalledWith({ where: { id: 1, ownerId: "a1" } });
      expect(m.virtualUsers.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, ownerId: null }));
    });
  });

  describe("attachAlias", () => {
    it("throws NotFound when the alias is absent", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.aliases.findOne.mockResolvedValue(null);
      await expect(svc.attachAlias("a1", 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("forbids assigning a postmaster alias", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.aliases.findOne.mockResolvedValue({ id: 1, source: "postmaster@ex.com", ownerId: null });

      const err = await svc.attachAlias("a1", 1).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
    });

    it("rejects an alias already assigned to someone", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      m.aliases.findOne.mockResolvedValue({ id: 1, source: "a@ex.com", ownerId: "other" });

      const err = await svc.attachAlias("a1", 1).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it("assigns a free alias to the account", async () => {
      m.accounts.findOne.mockResolvedValue({ id: "a1" });
      const alias = { id: 1, source: "a@ex.com", ownerId: null };
      m.aliases.findOne.mockResolvedValue(alias);
      m.aliases.save.mockResolvedValue({ ...alias, ownerId: "a1" });

      await svc.attachAlias("a1", 1);

      expect(m.aliases.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, ownerId: "a1" }));
    });
  });

  describe("detachAlias", () => {
    it("throws NotFound when the alias is not owned by the account", async () => {
      m.aliases.findOne.mockResolvedValue(null);
      await expect(svc.detachAlias("a1", 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("clears the owner of an alias the account owns", async () => {
      m.aliases.findOne.mockResolvedValue({ id: 1, source: "a@ex.com", ownerId: "a1" });

      await svc.detachAlias("a1", 1);

      expect(m.aliases.findOne).toHaveBeenCalledWith({ where: { id: 1, ownerId: "a1" } });
      expect(m.aliases.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, ownerId: null }));
    });
  });
});
