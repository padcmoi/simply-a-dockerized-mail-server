import { DataSource } from "typeorm";
import { Account } from "../entities/account.entity";
import { AccountProfile } from "../entities/account-profile.entity";
import { RefreshToken } from "../entities/refresh-token.entity";
import { DkimKeyEntity } from "../entities/dkim-key.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { VirtualAlias } from "../entities/virtual-alias.entity";
import { VirtualUser } from "../entities/virtual-user.entity";
import { VirtualQuotaDomain } from "../entities/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "../entities/virtual-quota-user.entity";
import { SieveRejectSender } from "../entities/sieve-reject-sender.entity";
import { Notification } from "../entities/notification.entity";
import { NotificationPreference } from "../entities/notification-preference.entity";
import { SupportTicket } from "../entities/support-ticket.entity";
import { SupportTicketMessage } from "../entities/support-ticket-message.entity";
import { SupportTicketRead } from "../entities/support-ticket-read.entity";
import { SupportTicketRecipient } from "../entities/support-ticket-recipient.entity";
import { SupportTicketAlias } from "../entities/support-ticket-alias.entity";
import { MailSetting } from "../entities/mail-setting.entity";
import { AppSetting } from "../entities/app-setting.entity";
import { DomainDelegation } from "../entities/domain-delegation.entity";
import { AccountInvitation } from "../entities/account-invitation.entity";
import { AccountTheme } from "../entities/account-theme.entity";
import { AppTheme } from "../entities/app-theme.entity";
import { AuditLog } from "../entities/audit-log.entity";
import { Group } from "../entities/group.entity";
import { GroupDomainPermission } from "../entities/group-domain-permission.entity";
import { GroupGlobalPermission } from "../entities/group-global-permission.entity";
import { GroupMember } from "../entities/group-member.entity";
import { MetricsHistory } from "../entities/metrics-history.entity";

// Stand-alone DataSource used exclusively by the TypeORM CLI (migration:generate,
// migration:run, migration:revert, migration:show). The Nest runtime keeps its
// own connection through TypeOrmModule.forRoot in app.module.ts. The two must
// stay in sync on driver + database + entities so generate diffs against the
// real schema. Run the CLI from inside the manager-api container so DB_* env
// vars are already injected by docker compose:
//   service.sh exec manager-api pnpm db:generate src/core/database/migrations/MyChange
export default new DataSource({
  type: "mariadb",
  host: process.env.DB_HOST ?? "mail-mariadb",
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  entities: [
    Account,
    AccountProfile,
    RefreshToken,
    DkimKeyEntity,
    VirtualDomain,
    VirtualAlias,
    VirtualUser,
    VirtualQuotaDomain,
    VirtualQuotaUser,
    SieveRejectSender,
    SupportTicket,
    SupportTicketMessage,
    SupportTicketRead,
    SupportTicketRecipient,
    SupportTicketAlias,
    Notification,
    NotificationPreference,
    MailSetting,
    AppSetting,
    DomainDelegation,
    AccountInvitation,
    AccountTheme,
    AppTheme,
    AuditLog,
    Group,
    GroupDomainPermission,
    GroupGlobalPermission,
    GroupMember,
    MetricsHistory,
  ],
  migrations: ["src/core/database/migrations/*.ts"],
  migrationsTableName: "migrations",
});
