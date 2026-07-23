import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountProfile } from "../entities/account-profile.entity";
import { AccountPresenceService } from "./account-presence.service";
import { PresenceActivityService } from "./presence-activity.service";
import { TopicPresenceService } from "./presence.service";

@Module({
  imports: [TypeOrmModule.forFeature([AccountProfile])],
  providers: [TopicPresenceService, PresenceActivityService, AccountPresenceService],
  exports: [TopicPresenceService, PresenceActivityService, AccountPresenceService],
})
export class TopicPresenceModule {}
