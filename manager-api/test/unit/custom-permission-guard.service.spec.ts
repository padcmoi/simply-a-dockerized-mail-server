import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";

// Replace createCustomPermissionGuard with a capturing stub: it returns a
// sentinel (asserted as svc.guard) and records the config object, so every
// data.* callback the service wires can be invoked directly against the mock
// repositories.
const h = vi.hoisted(() => {
  const sentinel = { __sentinel: "guard" };
  const captured: { config: any } = { config: undefined };
  return {
    sentinel,
    captured,
    createCustomPermissionGuard: vi.fn((config: any) => {
      captured.config = config;
      return sentinel;
    }),
  };
});

vi.mock("@naskot/custom-permission-guard", () => ({ createCustomPermissionGuard: h.createCustomPermissionGuard }));

import { CustomPermissionGuardService } from "../../src/core/custom-permission-guard/custom-permission-guard.service";
import { GLOBAL_ACTIONS, DOMAIN_ACTIONS } from "../../src/core/custom-permission-guard/permission-catalog";

// Inner repo handed to a transaction callback via manager.getRepository().
function makeInnerRepo() {
  const qb: any = {};
  qb.update = vi.fn(() => qb);
  qb.set = vi.fn(() => qb);
  qb.where = vi.fn(() => qb);
  qb.execute = vi.fn(async () => undefined);
  return {
    delete: vi.fn(async () => undefined),
    insert: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    createQueryBuilder: vi.fn(() => qb),
    __qb: qb,
  };
}

function makeRepo() {
  const txInner = makeInnerRepo();
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(),
    create: vi.fn((x: any) => x),
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    insert: vi.fn(async () => undefined),
    createQueryBuilder: vi.fn(),
    manager: { transaction: vi.fn(async (cb: (m: any) => Promise<void>) => cb({ getRepository: () => txInner })) },
    __txInner: txInner,
  };
}

// Chainable query builder for countGroupsWithGlobalPermission.
function makeCountQb(rows: unknown[]) {
  const qb: any = {};
  qb.select = vi.fn(() => qb);
  qb.where = vi.fn(() => qb);
  qb.andWhere = vi.fn(() => qb);
  qb.groupBy = vi.fn(() => qb);
  qb.having = vi.fn(() => qb);
  qb.getRawMany = vi.fn(async () => rows);
  return qb;
}

describe("CustomPermissionGuardService", () => {
  let accounts: ReturnType<typeof makeRepo>;
  let groups: ReturnType<typeof makeRepo>;
  let globalPerms: ReturnType<typeof makeRepo>;
  let domainPerms: ReturnType<typeof makeRepo>;
  let groupMembers: ReturnType<typeof makeRepo>;
  let domains: ReturnType<typeof makeRepo>;
  let svc: CustomPermissionGuardService;
  let config: any;
  let data: any;

  beforeEach(() => {
    accounts = makeRepo();
    groups = makeRepo();
    globalPerms = makeRepo();
    domainPerms = makeRepo();
    groupMembers = makeRepo();
    domains = makeRepo();
    svc = new CustomPermissionGuardService(
      accounts as never,
      groups as never,
      globalPerms as never,
      domainPerms as never,
      groupMembers as never,
      domains as never
    );
    config = h.captured.config;
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
      await expect(data.findDomainPermissions("g1")).resolves.toEqual([{ domainId: 1, resource: "recipients", action: "access" }]);
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
      const inner = globalPerms.__txInner;
      expect(inner.delete).toHaveBeenCalledWith({ groupId: "g1" });
      expect(inner.insert).toHaveBeenCalledWith([{ groupId: "g1", resource: "sieve", action: "access" }]);
    });

    it("setGroupGlobalPermissions clears without inserting when empty", async () => {
      await data.setGroupGlobalPermissions("g1", []);
      const inner = globalPerms.__txInner;
      expect(inner.delete).toHaveBeenCalledWith({ groupId: "g1" });
      expect(inner.insert).not.toHaveBeenCalled();
    });

    it("setGroupDomainPermissions replaces the set inside a transaction", async () => {
      await data.setGroupDomainPermissions("g1", [{ domainId: 1, resource: "recipients", action: "access" }]);
      const inner = domainPerms.__txInner;
      expect(inner.delete).toHaveBeenCalledWith({ groupId: "g1" });
      expect(inner.insert).toHaveBeenCalledWith([{ groupId: "g1", domainId: 1, resource: "recipients", action: "access" }]);
    });

    it("setGroupDomainPermissions clears without inserting when empty", async () => {
      await data.setGroupDomainPermissions("g1", []);
      expect(domainPerms.__txInner.insert).not.toHaveBeenCalled();
    });

    it("countGroupsWithGlobalPermission returns the number of matching groups", async () => {
      globalPerms.createQueryBuilder.mockReturnValue(makeCountQb([{ groupId: "g1" }, { groupId: "g2" }]));
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
      const inner = groups.__txInner;
      expect(inner.createQueryBuilder).toHaveBeenCalled();
      expect(inner.__qb.execute).toHaveBeenCalled();
      expect(inner.update).toHaveBeenCalledWith("g1", { isDefault: 1 });
    });

    it("setDefaultGroup only clears when passed null", async () => {
      await data.setDefaultGroup(null);
      const inner = groups.__txInner;
      expect(inner.__qb.execute).toHaveBeenCalled();
      expect(inner.update).not.toHaveBeenCalled();
    });
  });

  describe("root escape hatches", () => {
    it("rawSetGroupGlobalPermissions bypasses the guard but reuses the transactional writer", async () => {
      await svc.rawSetGroupGlobalPermissions("g1", [{ resource: "sieve", action: "access" }]);
      const inner = globalPerms.__txInner;
      expect(inner.delete).toHaveBeenCalledWith({ groupId: "g1" });
      expect(inner.insert).toHaveBeenCalledWith([{ groupId: "g1", resource: "sieve", action: "access" }]);
    });

    it("rawSetGroupGlobalPermissions clears without inserting when empty", async () => {
      await svc.rawSetGroupGlobalPermissions("g1", []);
      expect(globalPerms.__txInner.insert).not.toHaveBeenCalled();
    });

    it("rawDeleteGroup deletes directly", async () => {
      await svc.rawDeleteGroup("g1");
      expect(groups.delete).toHaveBeenCalledWith("g1");
    });
  });
});
