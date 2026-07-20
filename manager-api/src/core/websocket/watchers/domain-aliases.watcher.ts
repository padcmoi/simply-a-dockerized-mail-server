import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

export function domainAliasesWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "domain-aliases",
    scope: "domain",
    parameterized: true,
    permissions: [{ resource: "aliases", actions: ["access", "list-aliases"] }],
    fn: (param) =>
      dataSource.query(
        `SELECT id, source, destination FROM virtual_aliases
         WHERE domain = (SELECT domain FROM virtual_domains WHERE id = ?)`,
        [Number(param)]
      ),
  };
}
