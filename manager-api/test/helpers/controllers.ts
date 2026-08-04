// Every HTTP controller in the app, imported so the cartography test can reflect
// on its route/guard/permission metadata. A new controller that is not added
// here is caught by the "controller count" assertion in acl-cartography.spec.ts,
// which cross-checks this list against a glob of the source tree.
import { AccountsController } from "../../src/api/accounts/crud/crud.controller";
import { AccountsInvitationsController } from "../../src/api/accounts/invitations/invitations.controller";
import { AccountsSessionsController } from "../../src/api/accounts/sessions/sessions.controller";
import { MailConfigController } from "../../src/api/config/mail-config.controller";
import { MailCadenceController } from "../../src/api/config/mail-cadence.controller";
import { GeneralController } from "../../src/api/config/general.controller";
import { AdminDomainsController } from "../../src/api/domains/admin-domains/admin-domains.controller";
import { AliasesController } from "../../src/api/domains/aliases/aliases.controller";
import { DkimCheckController } from "../../src/api/domains/dkim-check/dkim-check.controller";
import { DkimController } from "../../src/api/domains/dkim/dkim.controller";
import { DomainsController } from "../../src/api/domains/domains.controller";
import { QuotasController } from "../../src/api/domains/quotas/quotas.controller";
import { RecipientsController } from "../../src/api/domains/recipients/recipients.controller";
import { DomainsRspamdController } from "../../src/api/domains/rspamd/rspamd.controller";
import { TicketsController } from "../../src/api/tickets/tickets.controller";
import { GroupsController } from "../../src/api/groups/groups.controller";
import { HealthController } from "../../src/api/health/health.controller";
import { MySpaceController } from "../../src/api/my-space/my-space.controller";
import { NotificationsController } from "../../src/api/notifications/notifications.controller";
import { PostfixController } from "../../src/api/postfix/postfix.controller";
import { RspamdController } from "../../src/api/rspamd/rspamd.controller";
import { RejectSendersController } from "../../src/api/sieve/reject-senders/reject-senders.controller";
import { ApiTokenController } from "../../src/core/auth/api-token/api-token.controller";
import { JwtAuthController } from "../../src/core/auth/jwt/jwt.controller";

export const ALL_CONTROLLERS = [
  AccountsController,
  AccountsInvitationsController,
  AccountsSessionsController,
  MailConfigController,
  MailCadenceController,
  GeneralController,
  AdminDomainsController,
  AliasesController,
  DkimCheckController,
  DkimController,
  DomainsController,
  QuotasController,
  RecipientsController,
  DomainsRspamdController,
  TicketsController,
  GroupsController,
  HealthController,
  MySpaceController,
  NotificationsController,
  PostfixController,
  RspamdController,
  RejectSendersController,
  ApiTokenController,
  JwtAuthController,
] as const;
