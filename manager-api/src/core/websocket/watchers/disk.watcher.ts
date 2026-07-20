import { DomainsService } from "../../../api/domains/domains.service";
import { Watcher } from "../watcher.type";

export function diskWatcher(domains: DomainsService): Watcher {
  return {
    topic: "domains-disk",
    permissions: [{ resource: "domains", actions: ["access", "view-disk-usage"] }],
    fn: () => domains.disk(),
  };
}
