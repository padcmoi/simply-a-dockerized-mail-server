import { DataSource } from "typeorm";
import { RspamdActions, RspamdDomainBayes, RspamdService } from "../../rspamd/rspamd.service";
import { Watcher } from "../watcher.type";

// RspamdService is stateless (history hits rspamd's HTTP API, domainBayes reads
// Redis) so it is instantiated directly rather than injected. This mirrors
// DomainsRspamdController.stats: tally the history's actions and fold per-recipient
// Bayes learns over the domain's mailbox list.
const rspamd = new RspamdService();

export function domainRspamdWatcher(dataSource: DataSource): Watcher {
  return {
    topic: "domain-rspamd",
    scope: "domain",
    parameterized: true,
    permissions: [{ resource: "rspamd", actions: ["access", "view-rspamd-stats"] }],
    fn: async (param) => {
      const [domainRow] = await dataSource.query(`SELECT domain FROM virtual_domains WHERE id = ?`, [Number(param)]);
      if (!domainRow) return null;
      const fqdn = domainRow.domain as string;

      const rows = await rspamd.history(fqdn);
      const actions: RspamdActions = {
        reject: 0,
        "soft reject": 0,
        "rewrite subject": 0,
        "add header": 0,
        greylist: 0,
        "no action": 0,
      };
      for (const row of rows) {
        if (row.action in actions) actions[row.action as keyof RspamdActions]++;
      }

      const trained = await rspamd.domainBayes(fqdn);
      const mailboxes: { email: string }[] = await dataSource.query(`SELECT email FROM virtual_users WHERE domain = ?`, [fqdn]);
      const byEmail = new Map<string, RspamdDomainBayes["recipients"][number]>();
      for (const m of mailboxes) byEmail.set(m.email.toLowerCase(), { recipient: m.email, learnsHam: 0, learnsSpam: 0 });
      for (const r of trained.recipients) byEmail.set(r.recipient.toLowerCase(), r);
      const recipients = [...byEmail.values()].sort((a, b) => b.learnsHam + b.learnsSpam - (a.learnsHam + a.learnsSpam));

      return { scanned: rows.length, actions, bayes: { recipients, totalHam: trained.totalHam, totalSpam: trained.totalSpam } };
    },
  };
}
