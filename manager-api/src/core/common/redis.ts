import * as net from "net";

// A tiny RESP client, shared by everything in the manager that has to read or
// write a key. The API container already talks to mail-redis (the healthcheck
// pings it), and a full client library would be a dependency for what fits in
// eighty lines: a command encoder, a reply parser, and one connection per call.

const REDIS_HOST = process.env.REDIS_HOST ?? "mail-redis";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const TIMEOUT_MS = 2000;

export type Resp = string | number | null | Resp[];

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
export function pipeline(commands: string[][]): Promise<Resp[]> {
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
