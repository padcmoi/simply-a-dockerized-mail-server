import { DataSource } from "typeorm";
import { PostfixService } from "../../postfix/postfix.service";
import { Watcher } from "../watcher.type";

// The postfix queue filtered to one domain. Its REST route is global
// (postfix:view-postfix-queue, filtered by ?domain=), so the topic is
// global-scoped even though it is parameterized by domain.
export function domainPostfixWatcher(dataSource: DataSource, postfix: PostfixService): Watcher {
  return {
    topic: "domain-postfix",
    scope: "global",
    parameterized: true,
    permissions: [{ resource: "postfix", actions: ["access", "view-postfix-queue"] }],
    fn: async (param) => {
      const [domainRow] = await dataSource.query(`SELECT domain FROM virtual_domains WHERE id = ?`, [Number(param)]);
      return postfix.queueStats(domainRow?.domain);
    },
  };
}
