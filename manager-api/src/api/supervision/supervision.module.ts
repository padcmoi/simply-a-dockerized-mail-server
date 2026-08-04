import { Module } from "@nestjs/common";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { SupervisionModule } from "../../core/supervision/supervision.module";
import { SupervisionController } from "./supervision.controller";

@Module({ imports: [SupervisionModule, CustomPermissionGuardModule], controllers: [SupervisionController] })
export class SupervisionApiModule {}
