import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

export function accountsWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "accounts",
    permissions: [{ resource: "accounts", actions: ["access", "list-accounts"] }],
    fn: async () => {
      const [row] = await dataSource.query(`SELECT MAX(updated_at) AS ts FROM accounts`);
      return row?.ts ?? null;
    },
  };
}
