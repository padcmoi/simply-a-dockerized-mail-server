import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

export function domainsWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "domains",
    permissions: [{ resource: "domains", actions: ["access"] }],
    fn: async () => {
      const [row] = await dataSource.query(`SELECT MAX(last_activity) AS ts FROM virtual_domains`);
      return row?.ts ?? null;
    },
  };
}
