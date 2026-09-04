import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActivityLog } from "../entities/activity-log.entity";
import { ActivityLogService } from "./activity-log.service";

// Imported by every module whose services write a line, explicitly rather
// than as a global: a module that records activity says so in its imports.
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
