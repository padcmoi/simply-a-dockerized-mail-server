import { Watcher } from "../watcher.type";

const RSPAMD_BASE_URL = "http://mail-rspamd:11334";

export function rspamdStatsWatcher(): Watcher {
  return {
    topic: "rspamd-stats",
    permissions: [{ resource: "rspamd", actions: ["access", "view-rspamd-stats"] }],
    intervalMs: 1_000,
    fn: async () => {
      const res = await fetch(`${RSPAMD_BASE_URL}/stat`);
      if (!res.ok) return null;
      return res.json();
    },
  };
}
