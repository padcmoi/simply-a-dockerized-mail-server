import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

export function aliasesWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "aliases",
    permissions: [{ resource: "domains", actions: ["access"] }],
    fn: async () => {
      const [row] = await dataSource.query(`SELECT MAX(last_activity) AS ts FROM virtual_aliases`);
      return row?.ts ?? null;
    },
  };
}
