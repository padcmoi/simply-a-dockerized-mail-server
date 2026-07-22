import { Module } from "@nestjs/common";
import { PresenceActivityService } from "./presence-activity.service";
import { TopicPresenceService } from "./presence.service";

@Module({
  providers: [TopicPresenceService, PresenceActivityService],
  exports: [TopicPresenceService, PresenceActivityService],
})
export class TopicPresenceModule {}
