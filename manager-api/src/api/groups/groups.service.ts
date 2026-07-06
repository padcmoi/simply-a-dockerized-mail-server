import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CustomPermissionGuardConfigError } from "@naskot/custom-permission-guard";
import { In, Like, Not, Repository } from "typeorm";
import type { PaginationQuery } from "../../core/common/pagination.validation";
import { AuditLogService } from "../../core/audit/audit-log.service";
import { CustomPermissionGuardService } from "../../core/custom-permission-guard/custom-permission-guard.service";
import { Account } from "../../core/entities/account.entity";
import { GroupMember } from "../../core/entities/group-member.entity";
import { Group } from "../../core/entities/group.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { CreateGroupDto, SetDomainPermissionsDto, SetGlobalPermissionsDto, UpdateGroupDto } from "./groups.validation";

type ActingUser = { id: number; isRoot: boolean };

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(GroupMember) private readonly groupMembers: Repository<GroupMember>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    private readonly cpg: CustomPermissionGuardService,
    private readonly auditLog: AuditLogService
  ) {}

  // `query.limit` absent = legacy unpaginated behavior, still relied on by
  // useGroups() picker consumers (accounts/index.vue's invite modal,
  // accounts/[id]/groups.vue's group picker) which need the full list.
  async list(query: PaginationQuery) {
    if (query.limit === undefined) {
      const allGroups = await this.groups.find({ order: { name: "ASC" } });
      return this.enrichGroups(allGroups);
    }

    const where = query.search ? [{ name: Like(`%${query.search}%`) }, { description: Like(`%${query.search}%`) }] : {};
    const [rows, total] = await this.groups.findAndCount({
      where,
      order: { createdAt: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit,
    });
    return { items: await this.enrichGroups(rows), total };
  }

  private async enrichGroups(allGroups: Group[]) {
    if (!allGroups.length) return [];

    const groupIds = allGroups.map((g) => g.id);
    const memberRows = await this.groupMembers.find({ where: { groupId: In(groupIds) } });
    const countMap = new Map<number, number>();
    memberRows.forEach((m) => countMap.set(m.groupId, (countMap.get(m.groupId) ?? 0) + 1));

    const ownerIds = [...new Set(allGroups.map((g) => g.ownerId).filter((id): id is number => id !== null))];
    const ownerMap = new Map<number, string>();
    if (ownerIds.length) {
      const owners = await this.accounts.findBy({ id: In(ownerIds) });
      owners.forEach((o) => ownerMap.set(o.id, o.username));
    }

    return allGroups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      createdAt: g.createdAt,
      ownerId: g.ownerId,
      ownerUsername: g.ownerId !== null ? (ownerMap.get(g.ownerId) ?? null) : null,
      isDefault: g.isDefault === 1,
      memberCount: countMap.get(g.id) ?? 0,
    }));
  }

  async create(ownerId: number, actingUserId: number, input: CreateGroupDto) {
    const existing = await this.groups.findOne({ where: { name: input.name } });
    if (existing) throw new ConflictException(`Group "${input.name}" already exists`);

    const groupId = await this.cpg.guard.createGroup(input.name);
    await this.cpg.guard.setGroupOwner(groupId, ownerId);
    if (input.description) await this.cpg.guard.updateGroup(groupId, { description: input.description });
    if (input.isDefault) await this.applyDefaultGroup(groupId, actingUserId);

    return this.toItem(await this.findOrFail(groupId));
  }

  async update(id: number, actingUserId: number, input: UpdateGroupDto) {
    const group = await this.findOrFail(id);
    if (input.name !== undefined && input.name !== group.name) {
      const clash = await this.groups.findOne({ where: { name: input.name, id: Not(id) } });
      if (clash) throw new ConflictException(`Group "${input.name}" already exists`);
    }
    if (input.name !== undefined || input.description !== undefined) {
      await this.cpg.guard.updateGroup(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        // The lib's public type only declares `description?: string` (no
        // null) -- mail-server allows explicitly clearing a description via
        // `null`, which our own `data.updateGroup` callback (see
        // custom-permission-guard.service.ts) forwards correctly at
        // runtime; only the compile-time type needs this cast.
        ...(input.description !== undefined ? { description: input.description as string | undefined } : {}),
      });
    }

    if (input.isDefault !== undefined) {
      if (input.isDefault) {
        await this.applyDefaultGroup(id, actingUserId);
      } else if (group.isDefault === 1) {
        await this.cpg.guard.setDefaultGroup(null);
        await this.auditLog.record({
          actorId: actingUserId,
          action: "group.default.changed",
          entityType: "group",
          entityId: id,
          before: { isDefault: true },
          after: { isDefault: false },
        });
      }
    }

    return this.toItem(await this.findOrFail(id));
  }

  // "Only one default group at a time" -- unicity itself is enforced by the
  // lib's setDefaultGroup (clear-then-set in a single transaction, see
  // custom-permission-guard.service.ts); this wrapper only adds the audit
  // trail, which stays out of the lib's scope.
  private async applyDefaultGroup(groupId: number, actorId: number) {
    await this.cpg.guard.setDefaultGroup(groupId);
    await this.auditLog.record({
      actorId,
      action: "group.default.changed",
      entityType: "group",
      entityId: groupId,
      after: { isDefault: true },
    });
  }

  async remove(id: number, actingUser: ActingUser) {
    await this.findOrFail(id);

    // Members drop this group's permissions once detached (ON DELETE CASCADE
    // on `group_members`, keeping any other group memberships intact);
    // capture the list here purely so the audit trail isn't a silent FK
    // side-effect. Read BEFORE deleting, and only audit AFTER a successful
    // delete: the lib's deleteGroup can now throw (lockoutProtected), which
    // the old code never risked between these two steps.
    const members = await this.groupMembers.find({ where: { groupId: id } });
    // Root is a 100% unconditional bypass of every ACL check, anti-lockout
    // included -- the lib's deleteGroup has no notion of "except root", so
    // root goes through the raw escape hatch instead.
    if (actingUser.isRoot) {
      await this.cpg.rawDeleteGroup(id);
    } else {
      await this.cpg.guard.deleteGroup(id);
    }
    await this.auditLog.record({
      actorId: actingUser.id,
      action: "group.deleted",
      entityType: "group",
      entityId: id,
      after: { detachedAccountIds: members.map((m) => m.accountId) },
    });

    return { ok: true };
  }

  async getDetail(id: number) {
    const group = await this.findOrFail(id);
    const item = await this.toItem(group);

    const [globalRows, domainRows] = await Promise.all([
      this.cpg.guard.findGroupGlobalPermissions(id),
      this.cpg.guard.findGroupDomainPermissions(id),
    ]);

    const domainIds = [...new Set(domainRows.map((p) => p.domainId))];
    const domainMap = new Map<number, string>();
    if (domainIds.length) {
      const found = await this.domains.findBy({ id: In(domainIds) });
      found.forEach((d) => domainMap.set(d.id, d.domain));
    }

    let owner: { id: number; username: string } | null = null;
    if (group.ownerId !== null) {
      const ownerAccount = await this.accounts.findOne({ where: { id: group.ownerId } });
      if (ownerAccount) owner = { id: ownerAccount.id, username: ownerAccount.username };
    }

    return {
      ...item,
      owner,
      globalPermissions: globalRows.map((p) => ({ resource: p.resource, action: p.action })),
      domainPermissions: domainRows.map((p) => ({
        domainId: p.domainId,
        domainName: domainMap.get(p.domainId) ?? "",
        resource: p.resource,
        action: p.action,
      })),
    };
  }

  async setGlobalPermissions(id: number, actingUser: ActingUser, permissions: SetGlobalPermissionsDto["permissions"]) {
    await this.findOrFail(id);

    // Anti-escalade: can't grant what you don't already hold yourself. Stays
    // out of the lib by design (composed from assertOne, see architecture.md
    // §1) -- only the cross-group anti-lockout check below lives in the lib.
    if (!actingUser.isRoot) {
      for (const p of permissions) {
        const held = await this.isGranted(() =>
          this.cpg.guard.assertOne.global(actingUser.id, p.resource, { acrud: [p.action] })
        );
        if (!held) throw new ForbiddenException("Cannot grant a permission you do not hold");
      }
    }

    const before = await this.cpg.guard.findGroupGlobalPermissions(id);

    // setGroupGlobalPermissions applies the access-prerequisite write-time
    // cleanup and the groups.access+modify anti-lockout invariant internally
    // (lockoutProtected, configured in custom-permission-guard.service.ts) --
    // replaces the old wouldLockOutGroupsManagement. Root is exempt from
    // anti-lockout too (100% unconditional bypass, see groups-anti-lockout.md),
    // so it uses the raw escape hatch instead of the lockout-protected path.
    if (actingUser.isRoot) {
      await this.cpg.rawSetGroupGlobalPermissions(id, permissions);
    } else {
      await this.cpg.guard.setGroupGlobalPermissions(id, permissions);
    }

    await this.auditLog.record({
      actorId: actingUser.id,
      action: "group.permissions.set",
      entityType: "group",
      entityId: id,
      before,
      after: permissions,
    });

    return this.getDetail(id);
  }

  async setDomainPermissions(id: number, actingUser: ActingUser, permissions: SetDomainPermissionsDto["permissions"]) {
    await this.findOrFail(id);

    if (permissions.length) {
      const domainIds = [...new Set(permissions.map((p) => p.domainId))];
      const found = await this.domains.findBy({ id: In(domainIds) });
      if (found.length !== domainIds.length) {
        throw new NotFoundException("One or more domain IDs not found");
      }
    }

    if (!actingUser.isRoot) {
      for (const p of permissions) {
        const held = await this.isGranted(() =>
          this.cpg.guard.assertOne.domain(actingUser.id, p.domainId, p.resource, { acrud: [p.action] })
        );
        if (!held) throw new ForbiddenException("Cannot grant a permission you do not hold");
      }
    }

    const before = await this.cpg.guard.findGroupDomainPermissions(id);
    await this.cpg.guard.setGroupDomainPermissions(id, permissions);

    await this.auditLog.record({
      actorId: actingUser.id,
      action: "group.permissions.set",
      entityType: "group",
      entityId: id,
      before,
      after: permissions,
    });

    return this.getDetail(id);
  }

  // Turns a throw-on-forbidden assertOne call into a boolean for the
  // anti-escalade pre-checks above -- never swallows a real misconfiguration.
  private async isGranted(fn: () => Promise<void>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (err) {
      if (err instanceof CustomPermissionGuardConfigError) throw err;
      return false;
    }
  }

  async updateOwner(id: number, actingUser: ActingUser, newOwnerId: number) {
    const group = await this.findOrFail(id);
    this.assertOwnerOrRoot(group, actingUser);
    const newOwner = await this.accounts.findOne({ where: { id: newOwnerId } });
    if (!newOwner) throw new NotFoundException(`Account #${newOwnerId} not found`);
    const before = group.ownerId;
    await this.cpg.guard.setGroupOwner(id, newOwnerId);

    await this.auditLog.record({
      actorId: actingUser.id,
      action: "group.owner.changed",
      entityType: "group",
      entityId: id,
      before: { ownerId: before },
      after: { ownerId: newOwnerId },
    });

    return this.getDetail(id);
  }

  async listMembers(id: number) {
    await this.findOrFail(id);
    return this.memberList(id);
  }

  async addMember(id: number, actingUser: ActingUser, accountId: number) {
    const group = await this.findOrFail(id);
    this.assertOwnerOrRoot(group, actingUser);
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account #${accountId} not found`);
    await this.cpg.guard.assignAccountToGroup(accountId, id);
    return this.memberList(id);
  }

  async removeMember(id: number, actingUser: ActingUser, accountId: number) {
    const group = await this.findOrFail(id);
    this.assertOwnerOrRoot(group, actingUser);
    const membership = await this.groupMembers.findOne({ where: { accountId, groupId: id } });
    if (!membership) {
      throw new NotFoundException(`Account #${accountId} is not a member of group #${id}`);
    }
    await this.cpg.guard.removeAccountFromGroup(accountId, id);
    return this.memberList(id);
  }

  private async findOrFail(id: number) {
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException(`Group #${id} not found`);
    return group;
  }

  private assertOwnerOrRoot(group: Group, actingUser: ActingUser) {
    if (actingUser.isRoot) return;
    if (group.ownerId === actingUser.id) return;
    throw new ForbiddenException("Only the group owner or a root account can perform this action");
  }

  private async toItem(group: Group) {
    const memberCount = await this.groupMembers.count({ where: { groupId: group.id } });
    let ownerUsername: string | null = null;
    if (group.ownerId !== null) {
      const owner = await this.accounts.findOne({ where: { id: group.ownerId } });
      ownerUsername = owner?.username ?? null;
    }
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      ownerId: group.ownerId,
      ownerUsername,
      isDefault: group.isDefault === 1,
      memberCount,
    };
  }

  private async memberList(id: number) {
    const rows = await this.groupMembers.find({ where: { groupId: id } });
    if (!rows.length) return [];
    const accs = await this.accounts.find({ where: { id: In(rows.map((r) => r.accountId)) }, order: { id: "ASC" } });
    return accs.map((a) => ({ id: a.id, username: a.username, name: a.name, email: a.email }));
  }
}
