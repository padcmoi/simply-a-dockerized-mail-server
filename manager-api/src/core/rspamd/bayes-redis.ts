import { pipeline, type Resp } from "../common/redis";

// Per-recipient Bayes learn counts, read straight from the Redis backend the
// rspamd classifier writes to (see images/rspamd/conf/local.d/classifier-bayes.conf:
// `per_user = true`, `selector = "rcpt:addr"`). Rspamd's own HTTP /stat endpoint
// only exposes a single server-wide aggregate with no per-domain or per-recipient
// breakdown, so the domain-scoped view has to go to Redis directly. The API
// container already talks to mail-redis (the healthcheck probe pings it), so this
// adds no new infra -- only a tiny RESP reader, the same raw-socket approach
// healthcheck.service.ts takes to avoid pulling in a full Redis client.

// The two SETs rspamd keeps of every statfile key it has ever written. Both HAM
// and SPAM statfiles for one recipient share a single hash key (learns_ham and
// learns_spam live side by side in it), so the two sets hold the same members --
// we union them defensively rather than assume it.
const HAM_KEYS_SET = "BAYES_HAM_keys";
const SPAM_KEYS_SET = "BAYES_SPAM_keys";
// rspamd's default Redis key prefix for the bayes statfiles (`RS<recipient>`).
// Stripped only to display the bare address; domain filtering matches on the
// `@domain` suffix so it never depends on the prefix.
const KEY_PREFIX = "RS";

export interface BayesRecipientStat {
  recipient: string;
  learnsHam: number;
  learnsSpam: number;
}

export interface RspamdDomainBayes {
  recipients: BayesRecipientStat[];
  totalHam: number;
  totalSpam: number;
}

function asStrings(v: Resp): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function toCount(v: Resp): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

// Reads the per-recipient Bayes learn counts for one domain. Only recipients of
// this domain that have actually trained a statfile appear; a domain nobody has
// trained on yields an empty list (totals 0), which is a valid answer, not an error.
export async function readDomainBayes(domain: string): Promise<RspamdDomainBayes> {
  const suffix = `@${domain.toLowerCase()}`;
  const [ham, spam] = await pipeline([
    ["SMEMBERS", HAM_KEYS_SET],
    ["SMEMBERS", SPAM_KEYS_SET],
  ]);
  const keys = [...new Set([...asStrings(ham), ...asStrings(spam)])].filter((k) => k.toLowerCase().endsWith(suffix));
  if (keys.length === 0) return { recipients: [], totalHam: 0, totalSpam: 0 };

  const learns = await pipeline(keys.map((k) => ["HMGET", k, "learns_ham", "learns_spam"]));
  let totalHam = 0;
  let totalSpam = 0;
  const recipients: BayesRecipientStat[] = keys.map((k, i) => {
    const pair = learns[i];
    const learnsHam = Array.isArray(pair) ? toCount(pair[0]) : 0;
    const learnsSpam = Array.isArray(pair) ? toCount(pair[1]) : 0;
    totalHam += learnsHam;
    totalSpam += learnsSpam;
    return {
      recipient: k.startsWith(KEY_PREFIX) ? k.slice(KEY_PREFIX.length) : k,
      learnsHam,
      learnsSpam,
    };
  });
  recipients.sort((a, b) => b.learnsHam + b.learnsSpam - (a.learnsHam + a.learnsSpam));
  return { recipients, totalHam, totalSpam };
}
