import { DataSource } from "typeorm";
import { DomainsService } from "../../../api/domains/domains.service";
import { JwtAuthService } from "../../auth/jwt/jwt.service";
import { PostfixService } from "../../postfix/postfix.service";
import { dashboardWatcher } from "./dashboard.watcher";
import { diskWatcher } from "./disk.watcher";
import { domainAliasesWatcher } from "./domain-aliases.watcher";
import { domainPostfixWatcher } from "./domain-postfix.watcher";
import { domainQuotaWatcher } from "./domain-quota.watcher";
import { domainRecipientsWatcher } from "./domain-recipients.watcher";
import { domainRspamdWatcher } from "./domain-rspamd.watcher";
import { postfixQueueWatcher } from "./postfix-queue.watcher";
import { rspamdStatsWatcher } from "./rspamd-stats.watcher";
import { sessionsWatcher } from "./sessions.watcher";
import { Watcher } from "../watcher.type";

export { MIN_INTERVAL_MS, Watcher } from "../watcher.type";

export interface WatcherDeps {
  dataSource: DataSource;
  domains: DomainsService;
  postfix: PostfixService;
  sessions: JwtAuthService;
}

export function buildWatchers(deps: WatcherDeps): Watcher[] {
  const { dataSource } = deps;
  return [
    rspamdStatsWatcher(),
    diskWatcher(deps.domains),
    postfixQueueWatcher(deps.postfix),
    sessionsWatcher(deps.sessions),
    dashboardWatcher(dataSource, deps.domains),
    domainRecipientsWatcher(dataSource),
    domainAliasesWatcher(dataSource),
    domainQuotaWatcher(dataSource),
    domainRspamdWatcher(dataSource),
    domainPostfixWatcher(dataSource, deps.postfix),
  ];
}
