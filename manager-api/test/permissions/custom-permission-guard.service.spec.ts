import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import type { ObjectLiteral, Repository } from "typeorm";
import type { CustomPermissionGuardConfig, GroupId } from "@naskot/custom-permission-guard";
import { CustomPermissionGuardService } from "../../src/core/custom-permission-guard/custom-permission-guard.service";
import { GLOBAL_ACTIONS, DOMAIN_ACTIONS } from "../../src/core/custom-permission-guard/permission-catalog";
import { Account } from "../../src/core/entities/account.entity";
import { Group } from "../../src/core/entities/group.entity";
import { GroupGlobalPermission } from "../../src/core/entities/group-global-permission.entity";
import { GroupDomainPermission } from "../../src/core/entities/group-domain-permission.entity";
import { GroupMember } from "../../src/core/entities/group-member.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { qbMock, repoMock, type Loose } from "../helpers/mocks";

// The service's updateGroup callback patches a null description through (the
// Group entity's description is nullable); the library types that callback's
// `description` as string-only. Widen just that member so the captured config
// reflects the real runtime contract the "including null" test exercises.
type ServiceConfig = Omit<CustomPermissionGuardConfig, "data"> & {
  data: Omit<CustomPermissionGuardConfig["data"], "updateGroup"> & {
    updateGroup(groupId: GroupId, changes: { name?: string; description?: string | null }): Promise<void>;
  };
};

// Replace createCustomPermissionGuard with a capturing stub: it returns a
// sentinel (asserted as svc.guard) and records the config object, so every
// data.* callback the service wires can be invoked directly against the mock
// repositories.
const h = vi.hoisted(() => {
  const sentinel = { __sentinel: "guard" };
  const captured: { config: ServiceConfig | undefined } = { config: undefined };
  return {
    sentinel,
    captured,
    createCustomPermissionGuard: vi.fn((config: ServiceConfig) => {
      captured.config = config;
      return sentinel;
    }),
  };
});

vi.mock("@naskot/custom-permission-guard", () => ({ createCustomPermissionGuard: h.createCustomPermissionGuard }));

// A chainable UPDATE query-builder double for setDefaultGroup's
// createQueryBuilder().update().set().where().execute() chain (qbMock only
// models SELECT builders, which have no update/set).
function makeUpdateQb() {
  const qb = {
    update: vi.fn(() => qb),
    set: vi.fn(() => qb),
    where: vi.fn(() => qb),
    execute: vi.fn(async () => undefined),
  };
  return qb;
}

// A transactional writer resolves its entity repo off manager.getRepository();
// point the outer repo's (readonly) manager at a stub whose transaction runs the
// callback with a manager returning `inner`, so the delete/insert/update/QB calls
// made inside the transaction land on `inner` and can be asserted.
function wireTransaction<Outer extends ObjectLiteral, Inner extends ObjectLiteral>(
  outer: Loose<Repository<Outer>>,
  inner: Loose<Repository<Inner>>
): void {
  const txManager = { getRepository: () => inner };
  const manager = { transaction: (run: (m: typeof txManager) => Promise<unknown>) => run(txManager) };
  Object.defineProperty(outer, "manager", { value: manager, configurable: true });
}

describe("CustomPermissionGuardService", () => {
  let accounts: Loose<Repository<Account>>;
  let groups: Loose<Repository<Group>>;
  let globalPerms: Loose<Repository<GroupGlobalPermission>>;
  let domainPerms: Loose<Repository<GroupDomainPermission>>;
  let groupMembers: Loose<Repository<GroupMember>>;
  let domains: Loose<Repository<VirtualDomain>>;
  let groupsTxInner: Loose<Repository<Group>>;
  let globalPermsTxInner: Loose<Repository<GroupGlobalPermission>>;
  let domainPermsTxInner: Loose<Repository<GroupDomainPermission>>;
  let updateQb: ReturnType<typeof makeUpdateQb>;
  let svc: CustomPermissionGuardService;
  let config: ServiceConfig;
  let data: ServiceConfig["data"];

  beforeEach(() => {
    accounts = repoMock<Account>();
    groups = repoMock<Group>();
    globalPerms = repoMock<GroupGlobalPermission>();
    domainPerms = repoMock<GroupDomainPermission>();
    groupMembers = repoMock<GroupMember>();
    domains = repoMock<VirtualDomain>();

    groupsTxInner = repoMock<Group>();
    globalPermsTxInner = repoMock<GroupGlobalPermission>();
    domainPermsTxInner = repoMock<GroupDomainPermission>();
    wireTransaction(groups, groupsTxInner);
    wireTransaction(globalPerms, globalPermsTxInner);
    wireTransaction(domainPerms, domainPermsTxInner);
    updateQb = makeUpdateQb();
    groupsTxInner.createQueryBuilder.mockReturnValue(updateQb);

    svc = new CustomPermissionGuardService(accounts, groups, globalPerms, domainPerms, groupMembers, domains);
    config = h.captured.config!;
    data = config.data;
  });

  describe("guard construction and config", () => {
    it("exposes the library's guard object", () => {
      expect(svc.guard).toBe(h.sentinel);
      expect(h.createCustomPermissionGuard).toHaveBeenCalledTimes(1);
    });

    it("configures multiple-group mode, acrud+custom dimensions and lockout protection", () => {
      expect(config.groupMode).toBe("multiple");
      expect(config.authorizedPermissions).toEqual({
        global: { acrud: true, custom: true },
        domain: { acrud: true, custom: true },
      });
      expect(config.lockoutProtected).toEqual([{ resource: "groups", actions: ["access", "edit-group-global-permissions"] }]);
    });

    it("builds schemas from the catalog and bridges the domain resource from global", () => {
      expect(Object.keys(config.schemas.global).sort()).toEqual(Object.keys(GLOBAL_ACTIONS).sort());
      expect(Object.keys(config.schemas.domain).sort()).toEqual(Object.keys(DOMAIN_ACTIONS).sort());
      expect(config.schemas.global.sieve.rules).toContain("access");
      expect(config.schemas.domain.domain.bridgeFromGlobal).toBe("domains");
      expect(config.schemas.domain.domain.dependsOn).toBeUndefined();
      expect(config.schemas.domain.recipients.dependsOn).toBeDefined();
      expect(config.schemas.global.groups.dependsOn).toBeDefined();
    });

    it("onForbidden throws a Nest ForbiddenException", () => {
      expect(() => config.onForbidden("nope")).toThrow(ForbiddenException);
    });
  });

  describe("read callbacks", () => {
    it("findAccountGroupIds maps group ids of the account's memberships", async () => {
      groupMembers.find.mockResolvedValue([{ groupId: "g1" }, { groupId: "g2" }]);
      await expect(data.findAccountGroupIds("acc")).resolves.toEqual(["g1", "g2"]);
      expect(groupMembers.find).toHaveBeenCalledWith({ where: { accountId: "acc" } });
    });

    it("findGlobalPermissions projects resource/action pairs", async () => {
      globalPerms.find.mockResolvedValue([{ resource: "sieve", action: "access", groupId: "g1" }]);
      await expect(data.findGlobalPermissions("g1")).resolves.toEqual([{ resource: "sieve", action: "access" }]);
      expect(globalPerms.find).toHaveBeenCalledWith({ where: { groupId: "g1" } });
    });

    it("findDomainPermissions projects domainId/resource/action", async () => {
      domainPerms.find.mockResolvedValue([{ domainId: 1, resource: "recipients", action: "access", groupId: "g1" }]);
      await expect(data.findDomainPermissions("g1")).resolves.toEqual([
        { domainId: 1, resource: "recipients", action: "access" },
      ]);
    });

    it("findOwnedDomainIds maps ids of the account's owned domains", async () => {
      domains.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await expect(data.findOwnedDomainIds("acc")).resolves.toEqual([1, 2]);
      expect(domains.find).toHaveBeenCalledWith({ where: { ownerId: "acc" } });
    });

    it("findGroupMemberIds maps account ids", async () => {
      groupMembers.find.mockResolvedValue([{ accountId: "a1" }, { accountId: "a2" }]);
      await expect(data.findGroupMemberIds("g1")).resolves.toEqual(["a1", "a2"]);
    });

    it("findDefaultGroupId returns the id or null", async () => {
      groups.findOne.mockResolvedValueOnce({ id: "g1" });
      await expect(data.findDefaultGroupId()).resolves.toBe("g1");
      expect(groups.findOne).toHaveBeenCalledWith({ where: { isDefault: 1 } });
      groups.findOne.mockResolvedValueOnce(null);
      await expect(data.findDefaultGroupId()).resolves.toBeNull();
    });

    it("findGroupProtected reflects the isProtected flag, defaulting to false", async () => {
      groups.findOne.mockResolvedValueOnce({ isProtected: 1 });
      await expect(data.findGroupProtected("g1")).resolves.toBe(true);
      expect(groups.findOne).toHaveBeenCalledWith({ where: { id: "g1" }, select: { isProtected: true } });
      groups.findOne.mockResolvedValueOnce({ isProtected: 0 });
      await expect(data.findGroupProtected("g1")).resolves.toBe(false);
      groups.findOne.mockResolvedValueOnce(null);
      await expect(data.findGroupProtected("g1")).resolves.toBe(false);
    });
  });

  describe("listGroups", () => {
    it("returns an empty list without counting members", async () => {
      groups.find.mockResolvedValue([]);
      await expect(data.listGroups()).resolves.toEqual([]);
      expect(groupMembers.find).not.toHaveBeenCalled();
    });

    it("maps flags and per-group member counts (including zero)", async () => {
      groups.find.mockResolvedValue([
        { id: "g1", name: "A", description: null, ownerId: null, isDefault: 1, isProtected: 0, createdAt: new Date(0) },
        { id: "g2", name: "B", description: "d", ownerId: "o", isDefault: 0, isProtected: 1, createdAt: new Date(0) },
        { id: "g3", name: "C", description: null, ownerId: null, isDefault: 0, isProtected: 0, createdAt: new Date(0) },
      ]);
      groupMembers.find.mockResolvedValue([{ groupId: "g1" }, { groupId: "g1" }, { groupId: "g2" }]);
      const res = await data.listGroups();
      expect(groupMembers.find).toHaveBeenCalledWith({ select: { groupId: true } });
      expect(res[0]).toMatchObject({ id: "g1", isDefault: true, protected: false, memberCount: 2 });
      expect(res[1]).toMatchObject({ id: "g2", isDefault: false, protected: true, memberCount: 1 });
      expect(res[2]).toMatchObject({ id: "g3", memberCount: 0 });
    });
  });

  describe("findGroup", () => {
    it("returns null when the group is absent", async () => {
      groups.findOne.mockResolvedValue(null);
      await expect(data.findGroup("gx")).resolves.toBeNull();
    });

    it("maps the group detail with boolean flags", async () => {
      groups.findOne.mockResolvedValue({
        id: "g1",
        name: "A",
        description: null,
        ownerId: null,
        isDefault: 1,
        isProtected: 1,
        createdAt: new Date(0),
      });
      await expect(data.findGroup("g1")).resolves.toMatchObject({ id: "g1", isDefault: true, protected: true });
    });
  });

  describe("write callbacks", () => {
    it("createGroup persists a fresh group and returns its id", async () => {
      groups.create.mockReturnValue({ name: "X" });
      groups.save.mockResolvedValue({ id: "new-id", name: "X" });
      await expect(data.createGroup("X")).resolves.toBe("new-id");
      expect(groups.create).toHaveBeenCalledWith({ name: "X", description: null, ownerId: null, isDefault: 0 });
    });

    it("updateGroup only patches provided fields", async () => {
      await data.updateGroup("g1", { name: "N", description: "D" });
      expect(groups.update).toHaveBeenCalledWith("g1", { name: "N", description: "D" });
    });

    it("updateGroup patches name only", async () => {
      await data.updateGroup("g1", { name: "N" });
      expect(groups.update).toHaveBeenCalledWith("g1", { name: "N" });
    });

    it("updateGroup patches description only (including null)", async () => {
      await data.updateGroup("g1", { description: null });
      expect(groups.update).toHaveBeenCalledWith("g1", { description: null });
    });

    it("updateGroup skips the write when nothing changed", async () => {
      await data.updateGroup("g1", {});
      expect(groups.update).not.toHaveBeenCalled();
    });

    it("setGroupOwner writes the owner (and null)", async () => {
      await data.setGroupOwner("g1", "acc");
      expect(groups.update).toHaveBeenCalledWith("g1", { ownerId: "acc" });
      await data.setGroupOwner("g1", null);
      expect(groups.update).toHaveBeenCalledWith("g1", { ownerId: null });
    });

    it("setGroupProtected writes 1 or 0", async () => {
      await data.setGroupProtected("g1", true);
      expect(groups.update).toHaveBeenCalledWith("g1", { isProtected: 1 });
      await data.setGroupProtected("g1", false);
      expect(groups.update).toHaveBeenCalledWith("g1", { isProtected: 0 });
    });

    it("deleteGroup deletes the row", async () => {
      await data.deleteGroup("g1");
      expect(groups.delete).toHaveBeenCalledWith("g1");
    });

    it("setGroupGlobalPermissions replaces the set inside a transaction", async () => {
      await data.setGroupGlobalPermissions("g1", [{ resource: "sieve", action: "access" }]);
      expect(globalPermsTxInner.delete).toHaveBeenCalledWith({ groupId: "g1" });
      expect(globalPermsTxInner.insert).toHaveBeenCalledWith([{ groupId: "g1", resource: "sieve", action: "access" }]);
    });

    it("setGroupGlobalPermissions clears without inserting when empty", async () => {
      await data.setGroupGlobalPermissions("g1", []);
      expect(globalPermsTxInner.delete).toHaveBeenCalledWith({ groupId: "g1" });
      expect(globalPermsTxInner.insert).not.toHaveBeenCalled();
    });

    it("setGroupDomainPermissions replaces the set inside a transaction", async () => {
      await data.setGroupDomainPermissions("g1", [{ domainId: 1, resource: "recipients", action: "access" }]);
      expect(domainPermsTxInner.delete).toHaveBeenCalledWith({ groupId: "g1" });
      expect(domainPermsTxInner.insert).toHaveBeenCalledWith([
        { groupId: "g1", domainId: 1, resource: "recipients", action: "access" },
      ]);
    });

    it("setGroupDomainPermissions clears without inserting when empty", async () => {
      await data.setGroupDomainPermissions("g1", []);
      expect(domainPermsTxInner.insert).not.toHaveBeenCalled();
    });

    it("countGroupsWithGlobalPermission returns the number of matching groups", async () => {
      const qb = qbMock<GroupGlobalPermission>();
      qb.getRawMany.mockResolvedValue([{ groupId: "g1" }, { groupId: "g2" }]);
      globalPerms.createQueryBuilder.mockReturnValue(qb);
      await expect(data.countGroupsWithGlobalPermission("groups", ["access", "edit-group-global-permissions"])).resolves.toBe(2);
    });

    it("assignAccountToGroup inserts when the membership is new", async () => {
      groupMembers.findOne.mockResolvedValue(null);
      await data.assignAccountToGroup("acc", "g1");
      expect(groupMembers.insert).toHaveBeenCalledWith({ accountId: "acc", groupId: "g1" });
    });

    it("assignAccountToGroup is idempotent when already a member", async () => {
      groupMembers.findOne.mockResolvedValue({ accountId: "acc", groupId: "g1" });
      await data.assignAccountToGroup("acc", "g1");
      expect(groupMembers.insert).not.toHaveBeenCalled();
    });

    it("removeAccountFromGroup deletes the membership", async () => {
      await data.removeAccountFromGroup("acc", "g1");
      expect(groupMembers.delete).toHaveBeenCalledWith({ accountId: "acc", groupId: "g1" });
    });

    it("setDefaultGroup clears the old default then sets the new one", async () => {
      await data.setDefaultGroup("g1");
      expect(groupsTxInner.createQueryBuilder).toHaveBeenCalled();
      expect(updateQb.execute).toHaveBeenCalled();
      expect(groupsTxInner.update).toHaveBeenCalledWith("g1", { isDefault: 1 });
    });

    it("setDefaultGroup only clears when passed null", async () => {
      await data.setDefaultGroup(null);
      expect(updateQb.execute).toHaveBeenCalled();
      expect(groupsTxInner.update).not.toHaveBeenCalled();
    });
  });

  describe("root escape hatches", () => {
    it("rawSetGroupGlobalPermissions bypasses the guard but reuses the transactional writer", async () => {
      await svc.rawSetGroupGlobalPermissions("g1", [{ resource: "sieve", action: "access" }]);
      expect(globalPermsTxInner.delete).toHaveBeenCalledWith({ groupId: "g1" });
      expect(globalPermsTxInner.insert).toHaveBeenCalledWith([{ groupId: "g1", resource: "sieve", action: "access" }]);
    });

    it("rawSetGroupGlobalPermissions clears without inserting when empty", async () => {
      await svc.rawSetGroupGlobalPermissions("g1", []);
      expect(globalPermsTxInner.insert).not.toHaveBeenCalled();
    });

    it("rawDeleteGroup deletes directly", async () => {
      await svc.rawDeleteGroup("g1");
      expect(groups.delete).toHaveBeenCalledWith("g1");
    });
  });
});
