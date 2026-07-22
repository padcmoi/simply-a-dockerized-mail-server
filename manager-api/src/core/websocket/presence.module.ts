import { Module } from "@nestjs/common";
import { TopicPresenceService } from "./presence.service";

@Module({
  providers: [TopicPresenceService],
  exports: [TopicPresenceService],
})
export class TopicPresenceModule {}
