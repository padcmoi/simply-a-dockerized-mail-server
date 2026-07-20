import { DataSource } from "typeorm";
import { accountsWatcher } from "./accounts.watcher";
import { aliasesWatcher } from "./aliases.watcher";
import { domainsWatcher } from "./domains.watcher";
import { quotasWatcher } from "./quotas.watcher";
import { recipientsWatcher } from "./recipients.watcher";
import { rejectSendersWatcher } from "./reject-senders.watcher";
import { rspamdStatsWatcher } from "./rspamd-stats.watcher";
import { Watcher } from "../watcher.type";

export { MIN_INTERVAL_MS, Watcher } from "../watcher.type";

export function buildWatchers(dataSource: DataSource): Watcher[] {
  return [
    domainsWatcher(dataSource),
    recipientsWatcher(dataSource),
    aliasesWatcher(dataSource),
    quotasWatcher(dataSource),
    rejectSendersWatcher(dataSource),
    accountsWatcher(dataSource),
    rspamdStatsWatcher(),
  ];
}
