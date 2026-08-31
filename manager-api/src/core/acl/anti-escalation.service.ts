import { ForbiddenException, Injectable } from "@nestjs/common";
import { CustomPermissionGuardService } from "../custom-permission-guard/custom-permission-guard.service";

export type ActingUser = { id: string; isRoot: boolean };

/**
 * Anti-escalation, the single source of truth: a non-root actor may only hand
 * out permissions it already holds itself. Every path that grants permissions
 * shares this one check -- editing a group's rules, adding a member to a group
 * that carries them, or inviting an account straight into one -- because holding
 * a group's membership grants its permissions by union.
 *
 * The escalation PREDICATE ("which of these permissions does this account not
 * hold") now comes straight from the library's `findUnheldPermissions`, the
 * agnostic primitive built for exactly this: it knows nothing about groups,
 * ownership of the grant, or root. This service keeps only what stays the
 * consumer's job -- the root bypass and the HTTP exception -- and lives OUTSIDE
 * core/custom-permission-guard so GroupsService and AccountsService share one
 * implementation instead of the inline duplication that once let addMember and
 * sendInvitation escalate.
 */
@Injectable()
export class AntiEscalationService {
  constructor(private readonly cpg: CustomPermissionGuardService) {}

  async assertActingUserHolds(
    actingUser: ActingUser,
    globalPermissions: { resource: string; action: string }[],
    domainPermissions: { domainId: number; resource: string; action: string }[],
    // Default fits the granting paths (edit perms, add member, invite). The
    // destruction path (deleting a group carrying rights you lack) reuses the
    // exact same predicate but reads better with its own wording.
    message = "Cannot grant a permission you do not hold"
  ): Promise<void> {
    if (actingUser.isRoot) return;
    const unheld = await this.cpg.guard.utils.findUnheldPermissions(actingUser.id, {
      global: globalPermissions,
      domain: domainPermissions,
    });
    if (unheld.global.length || unheld.domain.length) throw new ForbiddenException(message);
  }

  // For a full-replace EDIT of a group's permission set (setGroup*Permissions):
  // a non-root actor may only ADD or REMOVE permissions it holds itself. A
  // permission already on the group that the actor does not hold is left alone
  // as long as it is UNCHANGED -- so editing sieve on a group that also carries
  // rights above the actor is not blocked by those untouched rights. Only the
  // symmetric difference (added union removed) faces the holds check. Contrast
  // assertActingUserHolds, which the membership/delete paths use on the WHOLE
  // set because joining or deleting a group touches every permission it carries.
  async assertActingUserCanReplace(
    actingUser: ActingUser,
    beforeGlobal: { resource: string; action: string }[],
    afterGlobal: { resource: string; action: string }[],
    beforeDomain: { domainId: number; resource: string; action: string }[],
    afterDomain: { domainId: number; resource: string; action: string }[],
    message = "Cannot grant or revoke a permission you do not hold"
  ): Promise<void> {
    // The lib computes the delta (utils.diffPermissions); gating BOTH sides,
    // added and removed, is our policy -- revoking a right above the actor is
    // tampering, just as granting one is escalation.
    const { added, removed } = this.cpg.guard.utils.diffPermissions(
      { global: beforeGlobal, domain: beforeDomain },
      { global: afterGlobal, domain: afterDomain }
    );
    await this.assertActingUserHolds(
      actingUser,
      [...added.global, ...removed.global],
      [...added.domain, ...removed.domain],
      message
    );
  }
}
