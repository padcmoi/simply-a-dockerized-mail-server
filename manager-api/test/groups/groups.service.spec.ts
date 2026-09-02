import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { GroupsService } from "../../src/api/groups/groups.service";
import type { PaginationQuery } from "../../src/core/common/pagination.validation";
import type { ActingUser, AntiEscalationService } from "../../src/core/acl/anti-escalation.service";
import type { AuditLogService } from "../../src/core/audit/audit-log.service";
import type { SetDomainPermissionsDto, SetGlobalPermissionsDto } from "../../src/api/groups/groups.validation";
import { Account } from "../../src/core/entities/account.entity";
import { AccountProfile } from "../../src/core/entities/account-profile.entity";
import { Group } from "../../src/core/entities/group.entity";
import { GroupMember } from "../../src/core/entities/group-member.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { cpgMock, providerMock, qbMock, repoMock } from "../helpers/mocks";

const GID = "group-1";
const AID = "22222222-2222-2222-2222-222222222222";
const ROOT: ActingUser = { id: "root-id", isRoot: true };
const USER: ActingUser = { id: "user-id", isRoot: false };

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  isDefault: number;
  isProtected: number;
  isInvisible: number;
  createdAt: Date;
};

function makeGroup(over: Partial<GroupRow> = {}): GroupRow {
  return {
    id: GID,
    name: "Team",
    description: null,
    ownerId: null,
    isDefault: 0,
    isProtected: 0,
    isInvisible: 0,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...over,
  };
}

// One typed double per constructor argument, in order. Every dependency slots
// straight into the GroupsService constructor with no structural cast, so a wrong
// repo type or a DTO that violates the business shape now fails `tsc`.
function makeMocks() {
  const cpg = cpgMock();
  // rawSetGroupGlobalPermissions / rawDeleteGroup are the root-only escape
  // hatches on CustomPermissionGuardService itself (not on the `.guard` surface
  // cpgMock wires), so add them here rather than editing the helper.
  cpg.rawSetGroupGlobalPermissions = vi.fn();
  cpg.rawDeleteGroup = vi.fn();

  const accounts = repoMock<Account>();
  // listMembers builds a base query then clone()s it for the rows selection; the
  // clone must resolve to the same recorder so its orderBy/limit/offset/andWhere
  // calls (and getRawMany/getCount results) stay assertable on one object.
  const qb = qbMock<Account>();
  qb.clone = vi.fn(() => qb);
  accounts.createQueryBuilder.mockReturnValue(qb);

  return {
    qb,
    groups: repoMock<Group>(),
    accounts,
    profiles: repoMock<AccountProfile>(),
    groupMembers: repoMock<GroupMember>(),
    domains: repoMock<VirtualDomain>(),
    cpg,
    auditLog: providerMock<AuditLogService>({ record: vi.fn() }),
    antiEscalation: providerMock<AntiEscalationService>({
      assertActingUserHolds: vi.fn(),
      assertActingUserCanReplace: vi.fn(),
    }),
  };
}

const q = (over: Partial<PaginationQuery> = {}): PaginationQuery => ({ offset: 0, sortDir: "desc", ...over });

describe("GroupsService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: GroupsService;

  beforeEach(() => {
    m = makeMocks();
    svc = new GroupsService(
      m.groups,
      m.accounts,
      m.profiles,
      m.groupMembers,
      m.domains,
      m.cpg,
      m.auditLog,
      m.antiEscalation
    );
    // Sensible defaults so the many collaborators a method touches never blow up
    // on undefined; individual tests override the ones they assert on.
    m.groups.findOne.mockResolvedValue(makeGroup());
    m.groupMembers.find.mockResolvedValue([]);
    m.groupMembers.findOne.mockResolvedValue(null);
    m.groupMembers.count.mockResolvedValue(0);
    m.accounts.count.mockResolvedValue(0);
    m.accounts.find.mockResolvedValue([]);
    m.accounts.findBy.mockResolvedValue([]);
    m.accounts.findOne.mockResolvedValue(null);
    m.profiles.find.mockResolvedValue([]);
    m.domains.findBy.mockResolvedValue([]);
    m.cpg.guard.createGroup.mockResolvedValue("new-group-id");
    m.cpg.guard.findGroupGlobalPermissions.mockResolvedValue([]);
    m.cpg.guard.findGroupDomainPermissions.mockResolvedValue([]);
    m.cpg.guard.utils.check.global.mockResolvedValue(false);
    m.antiEscalation.assertActingUserHolds.mockResolvedValue(undefined);
    m.antiEscalation.assertActingUserCanReplace.mockResolvedValue(undefined);
    m.auditLog.record.mockResolvedValue(undefined);
  });

  describe("findOrFail (via getDetail)", () => {
    it("throws NotFound when the group does not exist", async () => {
      m.groups.findOne.mockResolvedValue(null);
      await expect(svc.getDetail(GID, ROOT)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("hides an invisible group from a non-root as a 404 (not 403)", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isInvisible: 1 }));
      await expect(svc.getDetail(GID, USER)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets root through an invisible group and maps its flags", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isInvisible: 1, isProtected: 1, isDefault: 1 }));
      const res = await svc.getDetail(GID, ROOT);
      expect(res.invisible).toBe(true);
      expect(res.protected).toBe(true);
      expect(res.isDefault).toBe(true);
    });
  });

  describe("list", () => {
    it("legacy (no limit) non-root filters invisible and enriches owners + counts", async () => {
      m.groups.find.mockResolvedValue([
        makeGroup({ id: "g1", ownerId: "o1", name: "g1", isDefault: 1, isProtected: 1, isInvisible: 1 }),
        makeGroup({ id: "g2", ownerId: "o2", name: "g2" }),
        makeGroup({ id: "g3", ownerId: null, name: "g3" }),
      ]);
      m.groupMembers.find.mockResolvedValue([{ groupId: "g1" }, { groupId: "g1" }, { groupId: "g2" }]);
      m.accounts.findBy.mockResolvedValue([{ id: "o1", email: "o1@x.com" }]);

      const res = await svc.list(USER, q());

      expect(m.groups.find).toHaveBeenCalledWith({ where: { isInvisible: 0 }, order: { name: "ASC" } });
      expect(res).toEqual([
        expect.objectContaining({ id: "g1", ownerEmail: "o1@x.com", memberCount: 2, isDefault: true, protected: true, invisible: true }),
        expect.objectContaining({ id: "g2", ownerEmail: null, memberCount: 1 }),
        expect.objectContaining({ id: "g3", ownerId: null, ownerEmail: null, memberCount: 0 }),
      ]);
    });

    it("legacy root does not filter invisible (base {})", async () => {
      m.groups.find.mockResolvedValue([]);
      await svc.list(ROOT, q());
      expect(m.groups.find).toHaveBeenCalledWith({ where: {}, order: { name: "ASC" } });
    });

    it("enrichGroups returns [] and skips member/owner lookups on an empty list", async () => {
      m.groups.find.mockResolvedValue([]);
      const res = await svc.list(ROOT, q());
      expect(res).toEqual([]);
      expect(m.groupMembers.find).not.toHaveBeenCalled();
    });

    it("enrichGroups skips the owner lookup when no group has an owner", async () => {
      m.groups.find.mockResolvedValue([makeGroup({ id: "g1", ownerId: null })]);
      const res = await svc.list(ROOT, q());
      // `list` returns the plain array only when no limit is given; narrow it.
      if (!Array.isArray(res)) throw new Error("expected the unpaginated list");
      expect(m.accounts.findBy).not.toHaveBeenCalled();
      expect(res[0]).toMatchObject({ ownerEmail: null, memberCount: 0 });
    });

    it("paginated: search builds the OR where and returns { items, total }", async () => {
      m.groups.findAndCount.mockResolvedValue([[makeGroup({ id: "g1", ownerId: null })], 1]);
      const res = await svc.list(USER, q({ limit: 25, search: "x", sortBy: "name", sortDir: "asc" }));
      // `list` returns a paginated shape only when a limit is given; narrow it.
      if (Array.isArray(res)) throw new Error("expected a paginated result");
      expect(res).toMatchObject({ total: 1 });
      expect(res.items).toHaveLength(1);
      const arg = m.groups.findAndCount.mock.calls[0][0];
      expect(arg.take).toBe(25);
      expect(arg.skip).toBe(0);
      expect(arg.order).toEqual({ name: "ASC" });
      expect(Array.isArray(arg.where)).toBe(true);
      expect(arg.where).toHaveLength(2);
    });

    it("paginated: no search uses the plain base where; root base is {}", async () => {
      m.groups.findAndCount.mockResolvedValue([[], 0]);
      await svc.list(ROOT, q({ limit: 10 }));
      expect(m.groups.findAndCount.mock.calls[0][0].where).toEqual({});
    });

    it("paginated: unknown sortBy falls back to createdAt DESC", async () => {
      m.groups.findAndCount.mockResolvedValue([[], 0]);
      await svc.list(USER, q({ limit: 10, sortBy: "bogus", sortDir: "desc" }));
      expect(m.groups.findAndCount.mock.calls[0][0].order).toEqual({ createdAt: "DESC" });
    });
  });

  describe("create", () => {
    it("rejects a duplicate name with 409 and never creates", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ name: "Team" }));
      await expect(svc.create("owner", "actor", { name: "Team" })).rejects.toBeInstanceOf(ConflictException);
      expect(m.cpg.guard.createGroup).not.toHaveBeenCalled();
    });

    it("creates, sets the owner, and skips description/default when absent", async () => {
      m.groups.findOne.mockResolvedValueOnce(null);
      await svc.create("owner", "actor", { name: "New" });
      expect(m.cpg.guard.createGroup).toHaveBeenCalledWith("New");
      expect(m.cpg.guard.setGroupOwner).toHaveBeenCalledWith("new-group-id", "owner");
      expect(m.cpg.guard.updateGroup).not.toHaveBeenCalled();
      expect(m.cpg.guard.setDefaultGroup).not.toHaveBeenCalled();
    });

    it("applies a description when provided", async () => {
      m.groups.findOne.mockResolvedValueOnce(null);
      await svc.create("owner", "actor", { name: "New", description: "hello" });
      expect(m.cpg.guard.updateGroup).toHaveBeenCalledWith("new-group-id", { description: "hello" });
    });

    it("marks the group as default and audits when isDefault is set", async () => {
      m.groups.findOne.mockResolvedValueOnce(null);
      await svc.create("owner", "actor", { name: "New", isDefault: true });
      expect(m.cpg.guard.setDefaultGroup).toHaveBeenCalledWith("new-group-id");
      expect(m.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "group.default.changed", after: { isDefault: true } })
      );
    });
  });

  describe("update", () => {
    it("renames when the new name is free and forwards it to the lib", async () => {
      const g = makeGroup({ name: "Old" });
      m.groups.findOne.mockResolvedValueOnce(g).mockResolvedValueOnce(null).mockResolvedValueOnce(g);
      await svc.update(GID, ROOT, { name: "New" });
      expect(m.cpg.guard.updateGroup).toHaveBeenCalledWith(GID, { name: "New" });
    });

    it("rejects a rename that clashes with an existing name", async () => {
      const g = makeGroup({ name: "Old" });
      m.groups.findOne.mockResolvedValueOnce(g).mockResolvedValueOnce(makeGroup({ id: "other", name: "New" }));
      await expect(svc.update(GID, ROOT, { name: "New" })).rejects.toBeInstanceOf(ConflictException);
      expect(m.cpg.guard.updateGroup).not.toHaveBeenCalled();
    });

    it("skips the clash query when the name is unchanged but still forwards it", async () => {
      const g = makeGroup({ name: "Same" });
      m.groups.findOne.mockResolvedValue(g);
      await svc.update(GID, ROOT, { name: "Same" });
      expect(m.cpg.guard.updateGroup).toHaveBeenCalledWith(GID, { name: "Same" });
      // findOrFail (start) + findOrFail (end) only -- no clash lookup.
      expect(m.groups.findOne).toHaveBeenCalledTimes(2);
    });

    it("forwards a description-only edit (including an explicit null clear)", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      await svc.update(GID, ROOT, { description: null });
      expect(m.cpg.guard.updateGroup).toHaveBeenCalledWith(GID, { description: null });
    });

    it("isDefault true applies the default group", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isDefault: 0 }));
      await svc.update(GID, ROOT, { isDefault: true });
      expect(m.cpg.guard.setDefaultGroup).toHaveBeenCalledWith(GID);
    });

    it("isDefault false on a currently-default group clears it and audits", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isDefault: 1 }));
      await svc.update(GID, ROOT, { isDefault: false });
      expect(m.cpg.guard.setDefaultGroup).toHaveBeenCalledWith(null);
      expect(m.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "group.default.changed", before: { isDefault: true }, after: { isDefault: false } })
      );
    });

    it("isDefault false on a non-default group is a no-op", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isDefault: 0 }));
      await svc.update(GID, ROOT, { isDefault: false });
      expect(m.cpg.guard.setDefaultGroup).not.toHaveBeenCalled();
    });

    it("a non-root cannot change protection", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isProtected: 0 }));
      await expect(svc.update(GID, USER, { protected: true })).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.guard.setGroupProtected).not.toHaveBeenCalled();
    });

    it("root toggles protection and audits", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isProtected: 0 }));
      await svc.update(GID, ROOT, { protected: true });
      expect(m.cpg.guard.setGroupProtected).toHaveBeenCalledWith(GID, true);
      expect(m.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "group.protection.changed" }));
    });

    it("a non-root re-submitting the unchanged protected value is allowed", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isProtected: 1 }));
      await expect(svc.update(GID, USER, { protected: true })).resolves.toBeDefined();
      expect(m.cpg.guard.setGroupProtected).not.toHaveBeenCalled();
    });

    it("a non-root cannot change visibility", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isInvisible: 0 }));
      await expect(svc.update(GID, USER, { invisible: true })).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.groups.update).not.toHaveBeenCalled();
    });

    it("root toggles visibility straight on the repo and audits", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isInvisible: 0 }));
      await svc.update(GID, ROOT, { invisible: true });
      expect(m.groups.update).toHaveBeenCalledWith(GID, { isInvisible: 1 });
      expect(m.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "group.visibility.changed" }));
    });

    it("root can reveal a currently-invisible group (isInvisible -> 0)", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isInvisible: 1 }));
      await svc.update(GID, ROOT, { invisible: false });
      expect(m.groups.update).toHaveBeenCalledWith(GID, { isInvisible: 0 });
    });

    it("a non-root re-submitting the unchanged invisible value is allowed", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isInvisible: 0 }));
      await expect(svc.update(GID, USER, { invisible: false })).resolves.toBeDefined();
      expect(m.groups.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("refuses to delete a protected group, even for root", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ isProtected: 1 }));
      await expect(svc.remove(GID, ROOT)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.rawDeleteGroup).not.toHaveBeenCalled();
      expect(m.cpg.guard.deleteGroup).not.toHaveBeenCalled();
    });

    it("propagates an anti-escalation refusal", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.antiEscalation.assertActingUserHolds.mockRejectedValueOnce(new ForbiddenException("nope"));
      await expect(svc.remove(GID, USER)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.guard.deleteGroup).not.toHaveBeenCalled();
    });

    it("root deletes via the raw escape hatch and audits the detached members", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.groupMembers.find.mockResolvedValue([{ accountId: "a1" }, { accountId: "a2" }]);
      const res = await svc.remove(GID, ROOT);
      expect(m.cpg.rawDeleteGroup).toHaveBeenCalledWith(GID);
      expect(m.cpg.guard.deleteGroup).not.toHaveBeenCalled();
      expect(m.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "group.deleted", after: { detachedAccountIds: ["a1", "a2"] } })
      );
      expect(res).toEqual({ ok: true });
    });

    it("a non-root deletes through the lib (lockout-protected path)", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      await svc.remove(GID, USER);
      expect(m.cpg.guard.deleteGroup).toHaveBeenCalledWith(GID);
      expect(m.cpg.rawDeleteGroup).not.toHaveBeenCalled();
    });
  });

  describe("getDetail", () => {
    it("computes nonMemberCount, null owner and empty domain map", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ ownerId: null }));
      m.accounts.count.mockResolvedValue(5);
      m.groupMembers.count.mockResolvedValue(2);
      m.cpg.guard.findGroupGlobalPermissions.mockResolvedValue([{ resource: "groups", action: "access" }]);
      m.cpg.guard.findGroupDomainPermissions.mockResolvedValue([]);
      const res = await svc.getDetail(GID, ROOT);
      expect(res.owner).toBeNull();
      expect(res.nonMemberCount).toBe(3);
      expect(res.globalPermissions).toEqual([{ resource: "groups", action: "access" }]);
      expect(res.domainPermissions).toEqual([]);
      expect(m.domains.findBy).not.toHaveBeenCalled();
    });

    it("resolves the owner and maps domain names (unknown domain -> empty string)", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ ownerId: "o1" }));
      m.accounts.findOne.mockResolvedValue({ id: "o1", email: "o1@x.com" });
      m.cpg.guard.findGroupDomainPermissions.mockResolvedValue([
        { domainId: 1, resource: "recipients", action: "access" },
        { domainId: 2, resource: "aliases", action: "access" },
      ]);
      m.domains.findBy.mockResolvedValue([{ id: 1, domain: "d1.com" }]);
      const res = await svc.getDetail(GID, ROOT);
      expect(res.owner).toEqual({ id: "o1", email: "o1@x.com" });
      expect(res.ownerEmail).toBe("o1@x.com");
      expect(res.domainPermissions).toEqual([
        { domainId: 1, domainName: "d1.com", resource: "recipients", action: "access" },
        { domainId: 2, domainName: "", resource: "aliases", action: "access" },
      ]);
    });

    it("leaves owner null when the owner account no longer exists", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ ownerId: "ghost" }));
      m.accounts.findOne.mockResolvedValue(null);
      const res = await svc.getDetail(GID, ROOT);
      expect(res.owner).toBeNull();
      expect(res.ownerEmail).toBeNull();
    });
  });

  describe("setGlobalPermissions", () => {
    const perms: SetGlobalPermissionsDto["permissions"] = [{ resource: "sieve", action: "access" }];

    it("a non-root goes through the lockout-protected lib path and audits", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.cpg.guard.findGroupGlobalPermissions.mockResolvedValue([]);
      await svc.setGlobalPermissions(GID, USER, perms);
      expect(m.antiEscalation.assertActingUserCanReplace).toHaveBeenCalledWith(USER, [], perms, [], []);
      expect(m.cpg.guard.setGroupGlobalPermissions).toHaveBeenCalledWith(GID, perms);
      expect(m.cpg.rawSetGroupGlobalPermissions).not.toHaveBeenCalled();
      expect(m.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "group.permissions.set" }));
    });

    it("root uses the raw escape hatch, bypassing anti-lockout", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      await svc.setGlobalPermissions(GID, ROOT, perms);
      expect(m.cpg.rawSetGroupGlobalPermissions).toHaveBeenCalledWith(GID, perms);
      expect(m.cpg.guard.setGroupGlobalPermissions).not.toHaveBeenCalled();
    });

    it("propagates an anti-escalation refusal before writing", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.antiEscalation.assertActingUserCanReplace.mockRejectedValueOnce(new ForbiddenException("nope"));
      await expect(svc.setGlobalPermissions(GID, USER, perms)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.guard.setGroupGlobalPermissions).not.toHaveBeenCalled();
    });
  });

  describe("setDomainPermissions", () => {
    const dperms: SetDomainPermissionsDto["permissions"] = [{ domainId: 1, resource: "recipients", action: "access" }];

    it("validates that referenced domains exist, then writes and audits", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.domains.findBy.mockResolvedValueOnce([{ id: 1, domain: "d1" }]);
      await svc.setDomainPermissions(GID, USER, dperms);
      expect(m.antiEscalation.assertActingUserCanReplace).toHaveBeenCalledWith(USER, [], [], [], dperms);
      expect(m.cpg.guard.setGroupDomainPermissions).toHaveBeenCalledWith(GID, dperms);
      expect(m.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "group.permissions.set" }));
    });

    it("rejects with 404 when a referenced domain does not exist", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.domains.findBy.mockResolvedValueOnce([]);
      await expect(svc.setDomainPermissions(GID, USER, dperms)).rejects.toBeInstanceOf(NotFoundException);
      expect(m.cpg.guard.setGroupDomainPermissions).not.toHaveBeenCalled();
    });

    it("skips the domain existence check for an empty permission set", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      await svc.setDomainPermissions(GID, USER, []);
      expect(m.cpg.guard.setGroupDomainPermissions).toHaveBeenCalledWith(GID, []);
    });

    it("propagates an anti-escalation refusal", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.domains.findBy.mockResolvedValueOnce([{ id: 1, domain: "d1" }]);
      m.antiEscalation.assertActingUserCanReplace.mockRejectedValueOnce(new ForbiddenException("nope"));
      await expect(svc.setDomainPermissions(GID, USER, dperms)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.guard.setGroupDomainPermissions).not.toHaveBeenCalled();
    });
  });

  describe("updateOwner (owner-or-root-or-permitted)", () => {
    it("denies a non-owner, non-root, unprivileged actor", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ ownerId: "someone-else" }));
      m.cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.updateOwner(GID, USER, AID)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.guard.setGroupOwner).not.toHaveBeenCalled();
    });

    it("404s when the new owner account does not exist", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.updateOwner(GID, ROOT, AID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("root transfers ownership and audits the change", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ ownerId: "old" }));
      m.accounts.findOne.mockResolvedValue({ id: AID, email: "new@x.com" });
      await svc.updateOwner(GID, ROOT, AID);
      expect(m.cpg.guard.setGroupOwner).toHaveBeenCalledWith(GID, AID);
      expect(m.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "group.owner.changed", before: { ownerId: "old" }, after: { ownerId: AID } })
      );
    });

    it("the current owner may transfer without holding the permission", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ ownerId: USER.id }));
      m.accounts.findOne.mockResolvedValue({ id: AID, email: "n" });
      await svc.updateOwner(GID, USER, AID);
      expect(m.cpg.guard.setGroupOwner).toHaveBeenCalled();
      expect(m.cpg.guard.utils.check.global).not.toHaveBeenCalled();
    });

    it("an actor holding transfer-group-ownership may transfer a group it does not own", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ ownerId: "other" }));
      m.cpg.guard.utils.check.global.mockResolvedValue(true);
      m.accounts.findOne.mockResolvedValue({ id: AID, email: "n" });
      await svc.updateOwner(GID, USER, AID);
      expect(m.cpg.guard.utils.check.global).toHaveBeenCalledWith(USER.id, "groups", "transfer-group-ownership");
      expect(m.cpg.guard.setGroupOwner).toHaveBeenCalled();
    });
  });

  describe("listMembers", () => {
    it("legacy (no limit) returns the enriched member array", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.groupMembers.find.mockResolvedValue([{ accountId: "a1" }]);
      m.accounts.find.mockResolvedValue([{ id: "a1", email: "a1@x.com" }]);
      m.profiles.find.mockResolvedValue([
        { accountId: "a1", firstName: "Alice", lastName: "Martin", avatarUrl: "https://cdn.example/a1.png" },
      ]);
      const res = await svc.listMembers(GID, ROOT, q());
      expect(res).toEqual([
        { id: "a1", email: "a1@x.com", displayName: "Alice Martin", avatarUrl: "https://cdn.example/a1.png" },
      ]);
    });

    it("legacy returns [] when the group has no members", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.groupMembers.find.mockResolvedValue([]);
      expect(await svc.listMembers(GID, ROOT, q())).toEqual([]);
    });

    it("legacy defaults a missing display name to null", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.groupMembers.find.mockResolvedValue([{ accountId: "a2" }]);
      m.accounts.find.mockResolvedValue([{ id: "a2", email: "a2@x.com" }]);
      m.profiles.find.mockResolvedValue([]);
      const res = await svc.listMembers(GID, ROOT, q());
      expect(res).toEqual([{ id: "a2", email: "a2@x.com", displayName: null, avatarUrl: null }]);
    });

    it("paginated: search + sortBy displayName asc orders on the name columns", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.qb.getRawMany.mockResolvedValue([
        { id: "a1", email: "a1@x.com", displayName: "Alice", avatarUrl: "https://cdn.example/a1.png" },
        { id: "a2", email: "a2@x.com", displayName: null },
      ]);
      m.qb.getCount.mockResolvedValue(2);
      const res = await svc.listMembers(GID, ROOT, q({ limit: 10, search: "a", sortBy: "displayName", sortDir: "asc" }));
      expect(res).toEqual({
        items: [
          { id: "a1", email: "a1@x.com", displayName: "Alice", avatarUrl: "https://cdn.example/a1.png" },
          { id: "a2", email: "a2@x.com", displayName: null, avatarUrl: null },
        ],
        total: 2,
      });
      expect(m.qb.andWhere).toHaveBeenCalled();
      // The display name is composed, so its sort orders on last then first name.
      expect(m.qb.orderBy).toHaveBeenCalledWith("p.lastName", "ASC");
      expect(m.qb.addOrderBy).toHaveBeenCalledWith("p.firstName", "ASC");
      expect(m.qb.limit).toHaveBeenCalledWith(10);
      expect(m.qb.offset).toHaveBeenCalledWith(0);
    });

    it("paginated: no search + default sort orders on a.email DESC", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.qb.getRawMany.mockResolvedValue([]);
      m.qb.getCount.mockResolvedValue(0);
      await svc.listMembers(GID, ROOT, q({ limit: 25, sortDir: "desc" }));
      expect(m.qb.andWhere).not.toHaveBeenCalled();
      expect(m.qb.orderBy).toHaveBeenCalledWith("a.email", "DESC");
    });
  });

  describe("addMember (owner-or-root-or-permitted + anti-escalation)", () => {
    it("denies an unprivileged non-owner", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup({ ownerId: "other" }));
      m.cpg.guard.utils.check.global.mockResolvedValue(false);
      await expect(svc.addMember(GID, USER, AID)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.guard.assignAccountToGroup).not.toHaveBeenCalled();
    });

    it("404s when the account does not exist", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.accounts.findOne.mockResolvedValue(null);
      await expect(svc.addMember(GID, ROOT, AID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("propagates an anti-escalation refusal", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.cpg.guard.utils.check.global.mockResolvedValue(true);
      m.accounts.findOne.mockResolvedValue({ id: AID });
      m.antiEscalation.assertActingUserHolds.mockRejectedValueOnce(new ForbiddenException("nope"));
      await expect(svc.addMember(GID, USER, AID)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.guard.assignAccountToGroup).not.toHaveBeenCalled();
    });

    it("root assigns the account and returns the refreshed member list", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.accounts.findOne.mockResolvedValue({ id: AID });
      m.groupMembers.find.mockResolvedValue([{ accountId: AID }]);
      m.accounts.find.mockResolvedValue([{ id: AID, email: "a@x.com" }]);
      m.profiles.find.mockResolvedValue([]);
      const res = await svc.addMember(GID, ROOT, AID);
      expect(m.cpg.guard.assignAccountToGroup).toHaveBeenCalledWith(AID, GID);
      expect(res).toEqual([{ id: AID, email: "a@x.com", displayName: null, avatarUrl: null }]);
    });
  });

  describe("addMembers (bulk)", () => {
    it("de-duplicates ids, assigns each found account, returns the count", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.accounts.find.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
      const res = await svc.addMembers(GID, ROOT, ["a1", "a2", "a1"]);
      expect(m.cpg.guard.assignAccountToGroup).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ added: 2 });
    });

    it("404s when one of the accounts does not exist", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.accounts.find.mockResolvedValue([{ id: "a1" }]);
      await expect(svc.addMembers(GID, ROOT, ["a1", "a2"])).rejects.toBeInstanceOf(NotFoundException);
      expect(m.cpg.guard.assignAccountToGroup).not.toHaveBeenCalled();
    });

    it("propagates an anti-escalation refusal", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.cpg.guard.utils.check.global.mockResolvedValue(true);
      m.accounts.find.mockResolvedValue([{ id: "a1" }]);
      m.antiEscalation.assertActingUserHolds.mockRejectedValueOnce(new ForbiddenException("nope"));
      await expect(svc.addMembers(GID, USER, ["a1"])).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.cpg.guard.assignAccountToGroup).not.toHaveBeenCalled();
    });
  });

  describe("removeMember", () => {
    it("404s when the account is not a member", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.groupMembers.findOne.mockResolvedValue(null);
      await expect(svc.removeMember(GID, ROOT, AID)).rejects.toBeInstanceOf(NotFoundException);
      expect(m.cpg.guard.removeAccountFromGroup).not.toHaveBeenCalled();
    });

    it("detaches the member and returns the refreshed list", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.groupMembers.findOne.mockResolvedValue({ accountId: AID, groupId: GID });
      m.groupMembers.find.mockResolvedValue([]);
      const res = await svc.removeMember(GID, ROOT, AID);
      expect(m.cpg.guard.removeAccountFromGroup).toHaveBeenCalledWith(AID, GID);
      expect(res).toEqual([]);
    });
  });

  describe("addAllAccounts (root-only)", () => {
    it("forbids a non-root before any lookup", async () => {
      await expect(svc.addAllAccounts(GID, USER)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.groups.findOne).not.toHaveBeenCalled();
    });

    it("root assigns every account and audits the count", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.accounts.find.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
      await svc.addAllAccounts(GID, ROOT);
      expect(m.cpg.guard.assignAccountToGroup).toHaveBeenCalledTimes(2);
      expect(m.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "group.members.assigned-all", after: { count: 2 } })
      );
    });
  });

  describe("removeAllMembers (root-only)", () => {
    it("forbids a non-root before any lookup", async () => {
      await expect(svc.removeAllMembers(GID, USER)).rejects.toBeInstanceOf(ForbiddenException);
      expect(m.groups.findOne).not.toHaveBeenCalled();
    });

    it("root removes every member and audits the count", async () => {
      m.groups.findOne.mockResolvedValue(makeGroup());
      m.groupMembers.find.mockResolvedValue([{ accountId: "a1" }, { accountId: "a2" }]);
      await svc.removeAllMembers(GID, ROOT);
      expect(m.cpg.guard.removeAccountFromGroup).toHaveBeenCalledTimes(2);
      expect(m.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "group.members.removed-all", before: { count: 2 } })
      );
    });
  });
});
