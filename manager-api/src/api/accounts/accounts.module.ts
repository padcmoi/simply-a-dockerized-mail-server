import { Module } from "@nestjs/common";
import { AccountsCrudModule } from "./crud/crud.module";
import { AccountsInvitationsModule } from "./invitations/invitations.module";
import { AccountsSessionsModule } from "./sessions/sessions.module";

// Aggregator for the accounts feature. It owns no controllers of its own: the
// account surface is split into three sibling sub-modules in this folder.
//
// Import ORDER matters. NestJS registers a module's own controllers before those
// of its imports, and routes are matched in registration order. The sessions and
// invitations controllers carry static-prefixed routes (e.g. `sessions/overview`,
// `invite/:token`) that would otherwise be captured by the CRUD controller's
// `:id`/`:id/overview` params. Listing them BEFORE AccountsCrudModule makes their
// routes register first, so the static prefixes win over the param routes.
@Module({
  imports: [AccountsSessionsModule, AccountsInvitationsModule, AccountsCrudModule],
})
export class AccountsModule {}
