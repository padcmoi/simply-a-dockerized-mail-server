import { Module } from "@nestjs/common";
import { CustomPermissionGuardModule } from "../custom-permission-guard/custom-permission-guard.module";
import { AntiEscalationService } from "./anti-escalation.service";

// Shared ACL policy that composes on top of @naskot/custom-permission-guard but
// is not the library's job (anti-escalation, root bypass). Consumed by both
// GroupsModule and AccountsModule.
@Module({
  imports: [CustomPermissionGuardModule],
  providers: [AntiEscalationService],
  exports: [AntiEscalationService],
})
export class AclModule {}
