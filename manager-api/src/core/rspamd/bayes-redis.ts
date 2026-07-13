import * as net from "net";

// Per-recipient Bayes learn counts, read straight from the Redis backend the
// rspamd classifier writes to (see images/rspamd/conf/local.d/classifier-bayes.conf:
// `per_user = true`, `selector = "rcpt:addr"`). Rspamd's own HTTP /stat endpoint
// only exposes a single server-wide aggregate with no per-domain or per-recipient
// breakdown, so the domain-scoped view has to go to Redis directly. The API
// container already talks to mail-redis (the healthcheck probe pings it), so this
// adds no new infra -- only a tiny RESP reader, the same raw-socket approach
// healthcheck.service.ts takes to avoid pulling in a full Redis client.

const REDIS_HOST = process.env.REDIS_HOST ?? "mail-redis";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const TIMEOUT_MS = 2000;

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

type Resp = string | number | null | Resp[];

function encode(cmd: string[]): string {
  let out = `*${cmd.length}\r\n`;
  for (const arg of cmd) out += `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`;
  return out;
}

// Minimal RESP reply parser. Returns null when `buf` does not yet hold a full
// reply (more bytes are still on the way), so the caller keeps buffering.
function parse(buf: Buffer, off: number): { value: Resp; next: number } | null {
  if (off >= buf.length) return null;
  const type = buf[off];
  const eol = buf.indexOf("\r\n", off);
  if (eol === -1) return null;
  const head = buf.toString("utf8", off + 1, eol);
  const after = eol + 2;
  switch (type) {
    case 0x2b: // '+' simple string
    case 0x2d: // '-' error (surfaced as a string; callers here never send failing commands)
      return { value: head, next: after };
    case 0x3a: // ':' integer
      return { value: Number(head), next: after };
    case 0x24: {
      // '$' bulk string
      const len = Number(head);
      if (len < 0) return { value: null, next: after };
      if (buf.length < after + len + 2) return null;
      return { value: buf.toString("utf8", after, after + len), next: after + len + 2 };
    }
    case 0x2a: {
      // '*' array
      const count = Number(head);
      if (count < 0) return { value: null, next: after };
      const arr: Resp[] = [];
      let cur = after;
      for (let i = 0; i < count; i++) {
        const r = parse(buf, cur);
        if (!r) return null;
        arr.push(r.value);
        cur = r.next;
      }
      return { value: arr, next: cur };
    }
    default:
      return null;
  }
}

// Sends a pipeline of commands over one connection and resolves with one reply
// per command, in order. Rejects on socket error or a 2s timeout.
function pipeline(commands: string[][]): Promise<Resp[]> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: REDIS_HOST, port: REDIS_PORT });
    let buf = Buffer.alloc(0);
    let settled = false;
    const timer = setTimeout(() => done(new Error("redis timeout")), TIMEOUT_MS);
    function done(err: Error | null, value?: Resp[]) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.destroy();
      if (err) reject(err);
      else resolve(value ?? []);
    }
    sock.once("connect", () => sock.write(commands.map(encode).join("")));
    sock.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const replies: Resp[] = [];
      let off = 0;
      for (let i = 0; i < commands.length; i++) {
        const r = parse(buf, off);
        if (!r) return; // incomplete pipeline, keep buffering
        replies.push(r.value);
        off = r.next;
      }
      done(null, replies);
    });
    sock.once("error", (e) => done(e));
  });
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
