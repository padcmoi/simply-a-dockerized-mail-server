import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Like, Not, Repository } from "typeorm";
import { resolveSortColumn, type PaginationQuery } from "../../core/common/pagination.validation";
import { AuditLogService } from "../../core/audit/audit-log.service";
import { CustomPermissionGuardService } from "../../core/custom-permission-guard/custom-permission-guard.service";
import type { GlobalAction } from "../../core/custom-permission-guard/permission-catalog";
import { AntiEscalationService, type ActingUser } from "../../core/acl/anti-escalation.service";
import { Account } from "../../core/entities/account.entity";
import { GroupMember } from "../../core/entities/group-member.entity";
import { Group } from "../../core/entities/group.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { CreateGroupDto, SetDomainPermissionsDto, SetGlobalPermissionsDto, UpdateGroupDto } from "./groups.validation";

// `ownerUsername`/`memberCount` (enriched post-query, see `enrichGroups`)
// aren't real columns on `groups` -- not sortable without a join/subquery,
// out of scope here.
export const GROUPS_SORTABLE_COLUMNS = ["name", "description", "createdAt"] as const;

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(GroupMember) private readonly groupMembers: Repository<GroupMember>,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    private readonly cpg: CustomPermissionGuardService,
    private readonly auditLog: AuditLogService,
    private readonly antiEscalation: AntiEscalationService
  ) {}

  // `query.limit` absent = legacy unpaginated behavior, still relied on by
  // useGroups() picker consumers (accounts/index.vue's invite modal,
  // accounts/[id]/groups.vue's group picker) which need the full list.
  // Invisible groups are hidden from every non-root account, on BOTH the
  // paginated list and the legacy unpaginated picker path. Root sees all.
  async list(actingUser: ActingUser, query: PaginationQuery) {
    const base = actingUser.isRoot ? {} : { isInvisible: 0 };
    if (query.limit === undefined) {
      const allGroups = await this.groups.find({ where: base, order: { name: "ASC" } });
      return this.enrichGroups(allGroups);
    }

    const where = query.search
      ? [
          { ...base, name: Like(`%${query.search}%`) },
          { ...base, description: Like(`%${query.search}%`) },
        ]
      : base;
    const sortBy = resolveSortColumn(query.sortBy, GROUPS_SORTABLE_COLUMNS, "createdAt");
    const [rows, total] = await this.groups.findAndCount({
      where,
      order: { [sortBy]: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit,
    });
    return { items: await this.enrichGroups(rows), total };
  }

  private async enrichGroups(allGroups: Group[]) {
    if (!allGroups.length) return [];

    const groupIds = allGroups.map((g) => g.id);
    const memberRows = await this.groupMembers.find({ where: { groupId: In(groupIds) } });
    const countMap = new Map<string, number>();
    memberRows.forEach((m) => countMap.set(m.groupId, (countMap.get(m.groupId) ?? 0) + 1));

    const ownerIds = [...new Set(allGroups.map((g) => g.ownerId).filter((id): id is string => id !== null))];
    const ownerMap = new Map<string, string>();
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
      protected: g.isProtected === 1,
      invisible: g.isInvisible === 1,
      memberCount: countMap.get(g.id) ?? 0,
    }));
  }

  async create(ownerId: string, actingUserId: string, input: CreateGroupDto) {
    const existing = await this.groups.findOne({ where: { name: input.name } });
    if (existing) throw new ConflictException(`Group "${input.name}" already exists`);

    // createGroup returns the lib's open `GroupId`; ours are always uuids.
    const groupId = (await this.cpg.guard.createGroup(input.name)) as string;
    await this.cpg.guard.setGroupOwner(groupId, ownerId);
    if (input.description) await this.cpg.guard.updateGroup(groupId, { description: input.description });
    if (input.isDefault) await this.applyDefaultGroup(groupId, actingUserId);

    return this.toItem(await this.findOrFail(groupId));
  }

  async update(id: string, actingUser: ActingUser, input: UpdateGroupDto) {
    const group = await this.findOrFail(id, actingUser);
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
        await this.applyDefaultGroup(id, actingUser.id);
      } else if (group.isDefault === 1) {
        await this.cpg.guard.setDefaultGroup(null);
        await this.auditLog.record({
          actorId: actingUser.id,
          action: "group.default.changed",
          entityType: "group",
          entityId: id,
          before: { isDefault: true },
          after: { isDefault: false },
        });
      }
    }

    // Toggling protection is ROOT-ONLY, deliberately not an ACL action: the
    // route is edit-group gated, but a non-root holding edit-group still cannot
    // protect/unprotect a group. Root bypasses the route guard and passes here.
    // Guarded on an actual change so a non-root editing name/description while
    // re-submitting the unchanged protected value is not rejected.
    if (input.protected !== undefined && input.protected !== (group.isProtected === 1)) {
      if (!actingUser.isRoot) {
        throw new ForbiddenException("Only a root account can change a group's protection");
      }
      await this.cpg.guard.setGroupProtected(id, input.protected);
      await this.auditLog.record({
        actorId: actingUser.id,
        action: "group.protection.changed",
        entityType: "group",
        entityId: id,
        before: { protected: group.isProtected === 1 },
        after: { protected: input.protected },
      });
    }

    // Toggling visibility is ROOT-ONLY too, and deliberately NOT an ACL (same
    // rationale as protection). Written straight to the repo -- invisibility is
    // a pure app-side view policy the guard lib never enforces. Guarded on an
    // actual change so a non-root re-submitting the unchanged value is fine.
    if (input.invisible !== undefined && input.invisible !== (group.isInvisible === 1)) {
      if (!actingUser.isRoot) {
        throw new ForbiddenException("Only a root account can change a group's visibility");
      }
      await this.groups.update(id, { isInvisible: input.invisible ? 1 : 0 });
      await this.auditLog.record({
        actorId: actingUser.id,
        action: "group.visibility.changed",
        entityType: "group",
        entityId: id,
        before: { invisible: group.isInvisible === 1 },
        after: { invisible: input.invisible },
      });
    }

    return this.toItem(await this.findOrFail(id, actingUser));
  }

  // "Only one default group at a time" -- unicity itself is enforced by the
  // lib's setDefaultGroup (clear-then-set in a single transaction, see
  // custom-permission-guard.service.ts); this wrapper only adds the audit
  // trail, which stays out of the lib's scope.
  private async applyDefaultGroup(groupId: string, actorId: string) {
    await this.cpg.guard.setDefaultGroup(groupId);
    await this.auditLog.record({
      actorId,
      action: "group.default.changed",
      entityType: "group",
      entityId: groupId,
      after: { isDefault: true },
    });
  }

  async remove(id: string, actingUser: ActingUser) {
    const group = await this.findOrFail(id, actingUser);

    // Protection is absolute: a protected group is never deletable, by anyone,
    // root included. The rule lives in the lib (guard.deleteGroup refuses it),
    // but root's rawDeleteGroup path below deliberately bypasses the lib, so it
    // is enforced here too, before either delete path and before anti-escalation.
    if (group.isProtected === 1) {
      throw new ForbiddenException("This group is protected and cannot be deleted");
    }

    // Anti-escalade also guards DESTRUCTION, not just granting: a non-root
    // holding delete-group must not be able to nuke a group more privileged
    // than itself. Deleting it isn't an escalation (it grants the actor
    // nothing), but it strips every member of rights the actor never held --
    // a sabotage path. Gated on GLOBAL permissions only, by design: the domain
    // tier is per-domain and has its own ownership semantics, so a group merely
    // carrying a domain permission you happen not to hold must NOT block you
    // from deleting it. You may delete a group whose global permissions you
    // hold in full. Root passes.
    const groupGlobal = await this.cpg.guard.findGroupGlobalPermissions(id);
    await this.antiEscalation.assertActingUserHolds(
      actingUser,
      groupGlobal,
      [],
      "Cannot delete a group carrying permissions you do not hold"
    );

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

  async getDetail(id: string, actingUser: ActingUser) {
    const group = await this.findOrFail(id, actingUser);
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

    let owner: { id: string; username: string } | null = null;
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

  async setGlobalPermissions(id: string, actingUser: ActingUser, permissions: SetGlobalPermissionsDto["permissions"]) {
    await this.findOrFail(id, actingUser);

    const before = await this.cpg.guard.findGroupGlobalPermissions(id);

    // Anti-escalade on the DELTA: a non-root may only add or remove permissions
    // it holds itself. Permissions already on the group that it does not hold
    // pass through untouched, so editing one resource is never blocked by
    // unrelated rights the group carries above the actor. The lib's
    // findUnheldPermissions computes "holds"; only the anti-lockout below lives
    // in the lib itself.
    await this.antiEscalation.assertActingUserCanReplace(actingUser, before, permissions, [], []);

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

    return this.getDetail(id, actingUser);
  }

  async setDomainPermissions(id: string, actingUser: ActingUser, permissions: SetDomainPermissionsDto["permissions"]) {
    await this.findOrFail(id, actingUser);

    if (permissions.length) {
      const domainIds = [...new Set(permissions.map((p) => p.domainId))];
      const found = await this.domains.findBy({ id: In(domainIds) });
      if (found.length !== domainIds.length) {
        throw new NotFoundException("One or more domain IDs not found");
      }
    }

    const before = await this.cpg.guard.findGroupDomainPermissions(id);

    // Anti-escalade on the DELTA (see setGlobalPermissions): only the domain
    // permissions actually added or removed face the holds check; untouched
    // rows the actor does not hold pass through.
    await this.antiEscalation.assertActingUserCanReplace(actingUser, [], [], before, permissions);

    await this.cpg.guard.setGroupDomainPermissions(id, permissions);

    await this.auditLog.record({
      actorId: actingUser.id,
      action: "group.permissions.set",
      entityType: "group",
      entityId: id,
      before,
      after: permissions,
    });

    return this.getDetail(id, actingUser);
  }

  async updateOwner(id: string, actingUser: ActingUser, newOwnerId: string) {
    const group = await this.findOrFail(id, actingUser);
    await this.assertOwnerOrRootOrPermitted(group, actingUser, "transfer-group-ownership");
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

    return this.getDetail(id, actingUser);
  }

  async listMembers(id: string, actingUser: ActingUser) {
    await this.findOrFail(id, actingUser);
    return this.memberList(id);
  }

  async addMember(id: string, actingUser: ActingUser, accountId: string) {
    const group = await this.findOrFail(id, actingUser);
    await this.assertOwnerOrRootOrPermitted(group, actingUser, "add-group-member");
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account #${accountId} not found`);

    // Anti-escalade on membership: joining a group grants ALL of its permissions
    // by union, so a non-root actor may only add a member (self included) to a
    // group whose permissions it already holds in full. Deliberately NOT gated by
    // ownership -- owning a root-created all-powerful group must not let you
    // inherit it by self-adding. Without this, `add-group-member` alone was a
    // privilege-escalation path: join the "admin" group, gain everything.
    const [groupGlobal, groupDomain] = await Promise.all([
      this.cpg.guard.findGroupGlobalPermissions(id),
      this.cpg.guard.findGroupDomainPermissions(id),
    ]);
    await this.antiEscalation.assertActingUserHolds(actingUser, groupGlobal, groupDomain);

    await this.cpg.guard.assignAccountToGroup(accountId, id);
    return this.memberList(id);
  }

  async removeMember(id: string, actingUser: ActingUser, accountId: string) {
    const group = await this.findOrFail(id, actingUser);
    await this.assertOwnerOrRootOrPermitted(group, actingUser, "remove-group-member");
    const membership = await this.groupMembers.findOne({ where: { accountId, groupId: id } });
    if (!membership) {
      throw new NotFoundException(`Account #${accountId} is not a member of group #${id}`);
    }
    await this.cpg.guard.removeAccountFromGroup(accountId, id);
    return this.memberList(id);
  }

  // When `actingUser` is passed, an invisible group is treated as nonexistent
  // for a non-root: a 404 (not 403) so the response never even confirms the
  // group exists. This makes invisibility airtight across every group endpoint
  // -- a non-root cannot view, edit, enumerate members of, or touch the
  // permissions of an invisible group even by guessing its id, whatever
  // permissions or membership it holds. Root always passes.
  private async findOrFail(id: string, actingUser?: ActingUser) {
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException(`Group #${id} not found`);
    if (actingUser && !actingUser.isRoot && group.isInvisible === 1) {
      throw new NotFoundException(`Group #${id} not found`);
    }
    return group;
  }

  // A disjunction, which is why it lives here and not on a decorator: a guard
  // can only AND, so declaring `add-group-member` on the route would have taken
  // the right away from the very owners it is meant to leave untouched. The
  // action is an ALTERNATIVE to owning the group.
  //
  // The route still names its action, via @ServiceEnforcedGlobalPermissions, so
  // it is typed against the catalog and appears in the generated permission
  // table. Unlike the domain tier, the guard lib has no ownership bypass for
  // groups (only `findOwnedDomainIds`), hence the hand-rolled check.
  private async assertOwnerOrRootOrPermitted(
    group: Group,
    actingUser: ActingUser,
    action: GlobalAction<"groups">
  ): Promise<void> {
    if (actingUser.isRoot) return;
    if (group.ownerId === actingUser.id) return;
    // check.global already folds in the access prerequisite (requires access +
    // action), so this is the "holds groups:<action>" leg of the disjunction --
    // a plain boolean from the lib, replacing the old throw-to-bool wrapper.
    if (await this.cpg.guard.utils.check.global(actingUser.id, "groups", action)) return;
    throw new ForbiddenException(`Only the group owner, a root account, or an account holding groups:${action} can do this`);
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
      protected: group.isProtected === 1,
      invisible: group.isInvisible === 1,
      memberCount,
    };
  }

  private async memberList(id: string) {
    const rows = await this.groupMembers.find({ where: { groupId: id } });
    if (!rows.length) return [];
    const accs = await this.accounts.find({ where: { id: In(rows.map((r) => r.accountId)) }, order: { id: "ASC" } });
    return accs.map((a) => ({ id: a.id, username: a.username, name: a.name, email: a.email }));
  }
}
