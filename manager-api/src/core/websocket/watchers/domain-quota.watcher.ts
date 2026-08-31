import { DataSource } from "typeorm";
import { Watcher } from "../watcher.type";

// Mirrors QuotasController.snapshot's unpaginated branch: the domain aggregate
// (dovecot's counters + the granted quota) plus every recipient's used bytes
// joined to its ceiling. Field names match the entity JSON the page consumes
// (lastActivity, not last_activity).
export function domainQuotaWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "domain-quota",
    scope: "domain",
    parameterized: true,
    permissions: [{ resource: "quotas", actions: ["access", "view-quotas"] }],
    fn: async (param) => {
      const [domainRow] = await dataSource.query(`SELECT domain, quota FROM virtual_domains WHERE id = ?`, [Number(param)]);
      if (!domainRow) return { domain: null, recipients: [] };
      const [counters] = await dataSource.query(
        `SELECT bytes, messages, last_activity AS lastActivity FROM virtual_quota_domains WHERE domain = ?`,
        [domainRow.domain]
      );
      const recipients = await dataSource.query(
        `SELECT q.id, q.email, q.bytes, COALESCE(u.quota, 0) quota
         FROM virtual_quota_users q
         LEFT JOIN virtual_users u ON u.email = q.email
         WHERE q.domain = ?
         ORDER BY q.email ASC`,
        [domainRow.domain]
      );
      return {
        domain: counters
          ? {
              bytes: String(counters.bytes),
              messages: String(counters.messages),
              lastActivity: counters.lastActivity,
              quota: String(domainRow.quota),
            }
          : null,
        recipients: recipients.map((r: { id: number; email: string; bytes: unknown; quota: unknown }) => ({
          id: r.id,
          email: r.email,
          bytes: String(r.bytes),
          quota: String(r.quota),
        })),
      };
    },
  };
}
