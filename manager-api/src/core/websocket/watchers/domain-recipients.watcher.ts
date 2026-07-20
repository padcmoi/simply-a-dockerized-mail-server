import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

export function domainRecipientsWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "domain-recipients",
    scope: "domain",
    parameterized: true,
    permissions: [{ resource: "recipients", actions: ["access", "list-recipients"] }],
    fn: (param) =>
      dataSource.query(
        `SELECT id, email, quota, active FROM virtual_users
         WHERE domain = (SELECT domain FROM virtual_domains WHERE id = ?)`,
        [Number(param)]
      ),
  };
}
