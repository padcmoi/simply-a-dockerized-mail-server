import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

export function quotasWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "quotas",
    permissions: [{ resource: "domains", actions: ["access"] }],
    fn: async () => {
      const [row] = await dataSource.query(`
        SELECT GREATEST(
          COALESCE((SELECT MAX(last_activity) FROM virtual_quota_users), '1970-01-01'),
          COALESCE((SELECT MAX(last_activity) FROM virtual_quota_domains), '1970-01-01')
        ) AS ts
      `);
      return row?.ts ?? null;
    },
  };
}
