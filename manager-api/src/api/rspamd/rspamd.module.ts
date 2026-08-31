import { Module } from "@nestjs/common";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { RspamdCoreModule } from "../../core/rspamd/rspamd.module";
import { RspamdController } from "./rspamd.controller";

@Module({ imports: [RspamdCoreModule, CustomPermissionGuardModule], controllers: [RspamdController] })
export class RspamdModule {}
