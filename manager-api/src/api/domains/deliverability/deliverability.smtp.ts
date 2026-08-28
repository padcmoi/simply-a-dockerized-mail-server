import { connect as tlsConnect, type PeerCertificate } from "node:tls";
import { connect as netConnect, type Socket } from "node:net";

// What the outside world sees when it talks to this server. Everything here
// is read-only probing: a banner, an EHLO, a certificate. No message is ever
// submitted, and the relay probe below stops before DATA.

const TIMEOUT_MS = 8000;

export interface SmtpProbe {
  reachable: boolean;
  banner: string;
  helo: string;
  capabilities: string[];
  startTls: boolean;
  error: string | null;
}

export interface CertProbe {
  subject: string;
  issuer: string;
  validTo: string;
  daysLeft: number;
  altNames: string[];
  error: string | null;
}

// A certificate can legitimately carry several CN values; the first is the one
// a verifier reads.
const flatten = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

function readUntil(socket: Socket, done: (buffer: string) => boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (done(buffer)) {
        socket.off("data", onData);
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
    socket.once("close", () => resolve(buffer));
  });
}

// A reply is complete when its last line has a space after the code rather
// than a dash. Postfix opens with a `220-Please wait ...` teaser on purpose
// (a pre-greeting trap), so waiting for the final line is not optional.
const complete = (buffer: string) => /^\d{3} [^\n]*\r?\n/m.test(buffer.split(/\r?\n/).filter(Boolean).slice(-1)[0] + "\r\n");

export async function probeSmtp(host: string, port = 25): Promise<SmtpProbe> {
  const empty: SmtpProbe = { reachable: false, banner: "", helo: "", capabilities: [], startTls: false, error: null };
  return new Promise<SmtpProbe>((resolve) => {
    const socket = netConnect({ host, port, timeout: TIMEOUT_MS });
    const fail = (error: string) => {
      socket.destroy();
      resolve({ ...empty, error });
    };
    socket.once("timeout", () => fail("timeout"));
    socket.once("error", (e) => fail(e.message));
    socket.once("connect", () => {
      void (async () => {
        try {
          const greeting = await readUntil(socket, complete);
          const banner = greeting
            .split(/\r?\n/)
            .filter((line) => /^220[ -]/.test(line))
            .pop();
          socket.write("EHLO deliverability.check\r\n");
          const ehlo = await readUntil(socket, complete);
          socket.write("QUIT\r\n");
          socket.end();

          const lines = ehlo.split(/\r?\n/).filter((line) => /^250[ -]/.test(line));
          const capabilities = lines.slice(1).map((line) => line.slice(4).trim());
          resolve({
            reachable: true,
            banner: (banner ?? "").replace(/^220[ -]/, "").trim(),
            helo: (lines[0] ?? "").slice(4).trim(),
            capabilities,
            startTls: capabilities.some((c) => c.toUpperCase().startsWith("STARTTLS")),
            error: null,
          });
        } catch (e) {
          fail((e as Error).message);
        }
      })();
    });
  });
}

// The certificate as a remote server would negotiate it, over STARTTLS on the
// same port a sending MTA uses - not over 465, which can carry a different
// certificate.
export async function probeCertificate(host: string, servername: string, port = 25): Promise<CertProbe> {
  const empty: CertProbe = { subject: "", issuer: "", validTo: "", daysLeft: 0, altNames: [], error: null };
  return new Promise<CertProbe>((resolve) => {
    const socket = netConnect({ host, port, timeout: TIMEOUT_MS });
    const fail = (error: string) => {
      socket.destroy();
      resolve({ ...empty, error });
    };
    socket.once("timeout", () => fail("timeout"));
    socket.once("error", (e) => fail(e.message));
    socket.once("connect", () => {
      void (async () => {
        try {
          await readUntil(socket, complete);
          socket.write("EHLO deliverability.check\r\n");
          await readUntil(socket, complete);
          socket.write("STARTTLS\r\n");
          const ready = await readUntil(socket, complete);
          if (!/^220/m.test(ready)) return fail("STARTTLS refused");

          const secure = tlsConnect({ socket, servername, rejectUnauthorized: false }, () => {
            const cert = secure.getPeerCertificate() as PeerCertificate;
            const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
            resolve({
              subject: flatten(cert.subject?.CN),
              issuer: flatten(cert.issuer?.CN),
              validTo: validTo ? validTo.toISOString() : "",
              daysLeft: validTo ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000) : 0,
              altNames: (cert.subjectaltname ?? "")
                .split(",")
                .map((n) => n.trim().replace(/^DNS:/, ""))
                .filter(Boolean),
              error: null,
            });
            secure.destroy();
          });
          secure.once("error", (e) => fail(e.message));
        } catch (e) {
          fail((e as Error).message);
        }
      })();
    });
  });
}

// An open relay is blacklisted within hours, so the check has to exist. It is
// deliberately stopped before DATA: the transaction is announced, the verdict
// read off the RCPT reply, and the session reset. Nothing is ever sent.
export type RelayVerdict = "closed" | "open" | "unknown";

export async function probeOpenRelay(host: string, port = 25): Promise<{ verdict: RelayVerdict; reply: string }> {
  return new Promise((resolve) => {
    const socket = netConnect({ host, port, timeout: TIMEOUT_MS });
    const give = (verdict: RelayVerdict, reply: string) => {
      socket.destroy();
      resolve({ verdict, reply });
    };
    socket.once("timeout", () => give("unknown", "timeout"));
    socket.once("error", (e) => give("unknown", e.message));
    socket.once("connect", () => {
      void (async () => {
        try {
          await readUntil(socket, complete);
          socket.write("EHLO deliverability.check\r\n");
          await readUntil(socket, complete);
          socket.write("MAIL FROM:<relay-probe@deliverability.check>\r\n");
          const from = await readUntil(socket, complete);
          if (!/^250/m.test(from)) return give("closed", from.trim().split(/\r?\n/).pop() ?? "");
          socket.write("RCPT TO:<relay-probe@example.com>\r\n");
          const rcpt = await readUntil(socket, complete);
          socket.write("RSET\r\nQUIT\r\n");
          socket.end();
          const line = rcpt.trim().split(/\r?\n/).pop() ?? "";
          give(/^250/m.test(rcpt) ? "open" : "closed", line);
        } catch (e) {
          give("unknown", (e as Error).message);
        }
      })();
    });
  });
}
