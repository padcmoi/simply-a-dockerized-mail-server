import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { Account } from "../../core/entities/account.entity";
import { AccountProfile } from "../../core/entities/account-profile.entity";
import { SupportTicket } from "../../core/entities/support-ticket.entity";
import { SupportTicketMessage } from "../../core/entities/support-ticket-message.entity";
import { SupportTicketRead } from "../../core/entities/support-ticket-read.entity";
import { DomainDelegation } from "../../core/entities/domain-delegation.entity";
import { VirtualAlias } from "../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../core/entities/virtual-user.entity";
import { NotificationsModule } from "../../core/notifications/notifications.module";
import { TopicPresenceModule } from "../../core/websocket/presence.module";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportTicket,
      SupportTicketMessage,
      SupportTicketRead,
      VirtualDomain,
      VirtualUser,
      VirtualAlias,
      DomainDelegation,
      Account,
      AccountProfile,
    ]),
    CustomPermissionGuardModule,
    NotificationsModule,
    TopicPresenceModule,
  ],
  providers: [TicketsService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
