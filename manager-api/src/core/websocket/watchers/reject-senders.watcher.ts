import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

export function rejectSendersWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "reject-senders",
    permissions: [{ resource: "sieve", actions: ["access", "list-reject-senders"] }],
    fn: async () => {
      const [row] = await dataSource.query(`SELECT MAX(updated_at) AS ts FROM sieve_reject_senders`);
      return row?.ts ?? null;
    },
  };
}
