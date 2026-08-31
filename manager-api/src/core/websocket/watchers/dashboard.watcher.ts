import { DataSource } from "typeorm";
import { DomainsService } from "../../../api/domains/domains.service";
import { Watcher } from "../watcher.type";

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

export function dashboardWatcher(dataSource: DataSource, domains: DomainsService): Watcher {
  return {
    topic: "dashboard",
    permissions: [{ resource: "domains", actions: ["access", "list-all-domains"] }],
    fn: async () => {
      const [domainAgg, recipientAgg, aliasAgg, rejectAgg, perDomain, recentDomains, recentRecipients, disk] = await Promise.all([
        dataSource.query(`SELECT COUNT(*) total, SUM(active) active FROM virtual_domains`),
        dataSource.query(`SELECT COUNT(*) total, SUM(active) active FROM virtual_users`),
        dataSource.query(`SELECT COUNT(*) total FROM virtual_aliases`),
        dataSource.query(`SELECT COUNT(*) total, SUM(enabled) enabled FROM sieve_reject_senders`),
        dataSource.query(`SELECT domain, COUNT(*) count FROM virtual_users GROUP BY domain ORDER BY count DESC LIMIT 8`),
        dataSource.query(`SELECT id, domain, quota, active FROM virtual_domains ORDER BY last_activity DESC LIMIT 5`),
        dataSource.query(`SELECT id, email, domain, active FROM virtual_users ORDER BY last_activity DESC LIMIT 6`),
        domains.disk().catch(() => null),
      ]);
      return {
        domains: { total: num(domainAgg[0]?.total), active: num(domainAgg[0]?.active) },
        recipients: { total: num(recipientAgg[0]?.total), active: num(recipientAgg[0]?.active) },
        aliases: { total: num(aliasAgg[0]?.total) },
        blockedSenders: { total: num(rejectAgg[0]?.total), enabled: num(rejectAgg[0]?.enabled) },
        disk,
        recipientsPerDomain: perDomain.map((r: { domain: string; count: unknown }) => ({
          domain: r.domain,
          count: num(r.count),
        })),
        recentDomains: recentDomains.map((d: { id: number; domain: string; quota: string; active: number }) => ({
          id: d.id,
          domain: d.domain,
          quota: String(d.quota),
          active: d.active,
        })),
        recentRecipients: recentRecipients.map((r: { id: number; email: string; domain: string; active: number }) => ({
          id: r.id,
          email: r.email,
          domain: r.domain,
          active: r.active,
        })),
      };
    },
  };
}
