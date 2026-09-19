import type { Fail2banService } from "../../fail2ban/fail2ban.service";
import { Watcher } from "../watcher.type";

export function fail2banWatcher(fail2ban: Fail2banService): Watcher {
  return {
    topic: "fail2ban",
    permissions: [{ resource: "fail2ban", actions: ["access", "view-fail2ban-jails"] }],
    intervalMs: 5_000,
    fn: () => fail2ban.status(),
  };
}
