import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

export function recipientsWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "recipients",
    permissions: [{ resource: "domains", actions: ["access"] }],
    fn: async () => {
      const [row] = await dataSource.query(`SELECT MAX(last_activity) AS ts FROM virtual_users`);
      return row?.ts ?? null;
    },
  };
}
