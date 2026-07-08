import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createCustomPermissionGuard } from "@naskot/custom-permission-guard";
import type { CustomPermissionGuard } from "@naskot/custom-permission-guard";
import { Repository } from "typeorm";
import { Account } from "../entities/account.entity";
import { GroupDomainPermission } from "../entities/group-domain-permission.entity";
import { GroupGlobalPermission } from "../entities/group-global-permission.entity";
import { GroupMember } from "../entities/group-member.entity";
import { Group } from "../entities/group.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { DOMAIN_RESOURCES, GLOBAL_RESOURCES, PERMISSION_ACTIONS, dependsOnFor } from "./permission-catalog";

// Only place in manager-api that calls createCustomPermissionGuard --
// mirrors @naskot/custom-permission-guard's own docs/nestjs.md pattern.
// `is_root` never appears here: the lib covers 100% of the group-based ACL
// model, root bypass is composed externally in global-permission.guard.ts /
// domain-permission.guard.ts, exactly as the library's docs require.
@Injectable()
export class CustomPermissionGuardService {
  readonly guard: CustomPermissionGuard;

  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupGlobalPermission) private readonly globalPerms: Repository<GroupGlobalPermission>,
    @InjectRepository(GroupDomainPermission) private readonly domainPerms: Repository<GroupDomainPermission>,
    @InjectRepository(GroupMember) private readonly groupMembers: Repository<GroupMember>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>
  ) {
    this.guard = createCustomPermissionGuard({
      onForbidden: (reason) => {
        throw new ForbiddenException(reason);
      },
      groupMode: "multiple",
      authorizedPermissions: {
        global: { acrud: true, custom: true },
        domain: { acrud: true, custom: true },
      },
      // Never lose the last group able to manage groups themselves -- replaces
      // the old GroupsService.wouldLockOutGroupsManagement.
      lockoutProtected: [{ resource: "groups", actions: ["access", "modify"] }],
      schemas: {
        global: Object.fromEntries(GLOBAL_RESOURCES.map((resource) => [resource, { rules: [...PERMISSION_ACTIONS] }])),
        domain: {
          // bridgeFromGlobal: holding domains.<action> globally also grants
          // "domain" on ANY domainId, without a dedicated row (Administration
          // > Domains override -- see domain-global-override.md).
          domain: { rules: [...PERMISSION_ACTIONS], bridgeFromGlobal: "domains" },
          ...Object.fromEntries(
            DOMAIN_RESOURCES.filter((resource) => resource !== "domain").map((resource) => [
              resource,
              { rules: [...PERMISSION_ACTIONS], dependsOn: dependsOnFor(resource) },
            ])
          ),
        },
      },
      data: {
        findAccountGroupIds: async (accountId) => {
          const rows = await this.groupMembers.find({ where: { accountId: accountId as number } });
          return rows.map((gm) => gm.groupId);
        },
        findGlobalPermissions: async (groupId) => {
          const rows = await this.globalPerms.find({ where: { groupId } });
          return rows.map((p) => ({ resource: p.resource, action: p.action }));
        },
        findDomainPermissions: async (groupId) => {
          const rows = await this.domainPerms.find({ where: { groupId } });
          return rows.map((p) => ({ domainId: p.domainId, resource: p.resource, action: p.action }));
        },
        findOwnedDomainIds: async (accountId) => {
          const rows = await this.domains.find({ where: { ownerId: accountId as number } });
          return rows.map((d) => d.id);
        },

        createGroup: async (name) => {
          const saved = await this.groups.save(this.groups.create({ name, description: null, ownerId: null, isDefault: 0 }));
          return saved.id;
        },
        listGroups: async () => {
          const allGroups = await this.groups.find();
          if (!allGroups.length) return [];
          const memberRows = await this.groupMembers.find({ select: { groupId: true } });
          const countMap = new Map<number, number>();
          memberRows.forEach((m) => countMap.set(m.groupId, (countMap.get(m.groupId) ?? 0) + 1));
          return allGroups.map((g) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            ownerId: g.ownerId,
            isDefault: g.isDefault === 1,
            memberCount: countMap.get(g.id) ?? 0,
            createdAt: g.createdAt,
          }));
        },
        findGroup: async (groupId) => {
          const g = await this.groups.findOne({ where: { id: groupId } });
          if (!g) return null;
          return {
            id: g.id,
            name: g.name,
            description: g.description,
            ownerId: g.ownerId,
            isDefault: g.isDefault === 1,
            createdAt: g.createdAt,
          };
        },
        updateGroup: async (groupId, changes) => {
          const patch: { name?: string; description?: string | null } = {};
          if (changes.name !== undefined) patch.name = changes.name;
          if (changes.description !== undefined) patch.description = changes.description;
          if (Object.keys(patch).length) await this.groups.update(groupId, patch);
        },
        setGroupOwner: async (groupId, accountId) => {
          await this.groups.update(groupId, { ownerId: accountId as number | null });
        },
        deleteGroup: async (groupId) => {
          await this.groups.delete(groupId);
        },

        setGroupGlobalPermissions: async (groupId, permissions) => {
          await this.writeGlobalPermissions(groupId, permissions);
        },
        setGroupDomainPermissions: async (groupId, permissions) => {
          await this.domainPerms.manager.transaction(async (manager) => {
            await manager.getRepository(GroupDomainPermission).delete({ groupId });
            if (permissions.length) {
              await manager
                .getRepository(GroupDomainPermission)
                .insert(permissions.map((p) => ({ groupId, domainId: p.domainId, resource: p.resource, action: p.action })));
            }
          });
        },
        countGroupsWithGlobalPermission: async (resource, actions) => {
          const rows = await this.globalPerms
            .createQueryBuilder("p")
            .select("p.group_id", "groupId")
            .where("p.resource = :resource", { resource })
            .andWhere("p.action IN (:...actions)", { actions })
            .groupBy("p.group_id")
            .having("COUNT(DISTINCT p.action) = :n", { n: actions.length })
            .getRawMany();
          return rows.length;
        },

        assignAccountToGroup: async (accountId, groupId) => {
          const exists = await this.groupMembers.findOne({ where: { accountId: accountId as number, groupId } });
          if (!exists) {
            await this.groupMembers.insert({ accountId: accountId as number, groupId });
          }
        },
        findGroupMemberIds: async (groupId) => {
          const rows = await this.groupMembers.find({ where: { groupId } });
          return rows.map((gm) => gm.accountId);
        },
        removeAccountFromGroup: async (accountId, groupId) => {
          await this.groupMembers.delete({ accountId: accountId as number, groupId });
        },

        setDefaultGroup: async (groupId) => {
          await this.groups.manager.transaction(async (manager) => {
            await manager
              .getRepository(Group)
              .createQueryBuilder()
              .update(Group)
              .set({ isDefault: 0 })
              .where("is_default = 1")
              .execute();
            if (groupId !== null) await manager.getRepository(Group).update(groupId, { isDefault: 1 });
          });
        },
        findDefaultGroupId: async () => {
          const found = await this.groups.findOne({ where: { isDefault: 1 } });
          return found?.id ?? null;
        },
      },
    });
  }

  private async writeGlobalPermissions(groupId: number, permissions: { resource: string; action: string }[]) {
    await this.globalPerms.manager.transaction(async (manager) => {
      await manager.getRepository(GroupGlobalPermission).delete({ groupId });
      if (permissions.length) {
        await manager
          .getRepository(GroupGlobalPermission)
          .insert(permissions.map((p) => ({ groupId, resource: p.resource, action: p.action })));
      }
    });
  }

  // `lockoutProtected` has no notion of an acting user -- it can't be told
  // "except when root is asking". mail-server's rule is that root is a 100%
  // unconditional bypass of every ACL check, anti-lockout included (see
  // groups-anti-lockout.md: this was previously a real regression, fixed by
  // explicit user feedback). These two escape hatches let GroupsService give
  // root a path that never consults lockoutProtected -- every other caller
  // still goes through guard.setGroupGlobalPermissions/deleteGroup above and
  // gets the protection.
  async rawSetGroupGlobalPermissions(groupId: number, permissions: { resource: string; action: string }[]) {
    await this.writeGlobalPermissions(groupId, permissions);
  }

  async rawDeleteGroup(groupId: number) {
    await this.groups.delete(groupId);
  }
}
