import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { Account } from "../../core/entities/account.entity";
import { AccountProfile } from "../../core/entities/account-profile.entity";
import { SupportTicket } from "../../core/entities/support-ticket.entity";
import { SupportTicketMessage } from "../../core/entities/support-ticket-message.entity";
import { SupportTicketRead } from "../../core/entities/support-ticket-read.entity";
import { SupportTicketRecipient } from "../../core/entities/support-ticket-recipient.entity";
import { SupportTicketAlias } from "../../core/entities/support-ticket-alias.entity";
import { DomainDelegation } from "../../core/entities/domain-delegation.entity";
import { VirtualAlias } from "../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { NotificationsModule } from "../../core/notifications/notifications.module";
import { SettingsModule } from "../../core/settings/settings.module";
import { TopicPresenceModule } from "../../core/websocket/presence.module";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { ActivityLogModule } from "../../core/activity/activity-log.module";

@Module({
  imports: [
    ActivityLogModule,
    TypeOrmModule.forFeature([
      SupportTicket,
      SupportTicketMessage,
      SupportTicketRead,
      SupportTicketRecipient,
      SupportTicketAlias,
      VirtualDomain,
      VirtualUser,
      VirtualAlias,
      DomainDelegation,
      Account,
      AccountProfile,
    ]),
    CustomPermissionGuardModule,
    NotificationsModule,
    SettingsModule,
    TopicPresenceModule,
  ],
  providers: [TicketsService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
