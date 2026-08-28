import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { probeCertificate, probeOpenRelay, probeSmtp } from "../../src/api/domains/deliverability/deliverability.smtp";

// The probes are tested against a real socket speaking a scripted SMTP: it is
// the only way to pin what they actually parse - a multi-line greeting, a
// capability list, a refusal - without pretending a network never misbehaves.

let server: Server | null = null;

function serve(script: (socket: Socket) => void): Promise<number> {
  return new Promise((resolve) => {
    server = createServer(script);
    server.listen(0, "127.0.0.1", () => resolve((server!.address() as { port: number }).port));
  });
}

// Postfix opens with `220-Please wait ...` before the real greeting, on
// purpose. A reader stopping at the first line would take the teaser for the
// banner, so the script below always sends one.
function smtpScript(options: { starttls?: boolean; acceptRcpt?: boolean } = {}) {
  return (socket: Socket) => {
    socket.write("220-Please wait ...\r\n220 mail.example.org ESMTP Postfix\r\n");
    socket.on("data", (chunk) => {
      const line = chunk.toString();
      if (line.startsWith("EHLO")) {
        const caps = ["250-mail.example.org", "250-PIPELINING", "250-SIZE 20480000"];
        if (options.starttls !== false) caps.push("250-STARTTLS");
        socket.write(`${caps.join("\r\n")}\r\n250 CHUNKING\r\n`);
      } else if (line.startsWith("MAIL FROM")) socket.write("250 2.1.0 Ok\r\n");
      else if (line.startsWith("RCPT TO")) {
        socket.write(options.acceptRcpt ? "250 2.1.5 Ok\r\n" : "554 5.7.1 Relay access denied\r\n");
      } else if (line.startsWith("STARTTLS")) socket.write("454 4.7.0 TLS not available\r\n");
      else if (line.startsWith("QUIT") || line.startsWith("RSET")) socket.write("221 2.0.0 Bye\r\n");
    });
  };
}

afterEach(() => {
  server?.close();
  server = null;
});

describe("deliverability SMTP probes", () => {
  describe("probeSmtp", () => {
    it("reads the banner past the multi-line teaser, and the EHLO name", async () => {
      const port = await serve(smtpScript());
      const probe = await probeSmtp("127.0.0.1", port);
      expect(probe.reachable).toBe(true);
      expect(probe.banner).toBe("mail.example.org ESMTP Postfix");
      expect(probe.helo).toBe("mail.example.org");
    });

    it("collects the capabilities and spots STARTTLS among them", async () => {
      const port = await serve(smtpScript());
      const probe = await probeSmtp("127.0.0.1", port);
      expect(probe.capabilities).toContain("PIPELINING");
      expect(probe.startTls).toBe(true);
    });

    it("reports a server that offers no STARTTLS", async () => {
      const port = await serve(smtpScript({ starttls: false }));
      await expect(probeSmtp("127.0.0.1", port)).resolves.toMatchObject({ reachable: true, startTls: false });
    });

    it("reports an unreachable port as unreachable, with the reason", async () => {
      const probe = await probeSmtp("127.0.0.1", 1);
      expect(probe.reachable).toBe(false);
      expect(probe.error).toBeTruthy();
    });
  });

  describe("probeOpenRelay", () => {
    // The transaction is announced and abandoned before DATA: the verdict is
    // read off the RCPT reply, and nothing is ever sent.
    it("calls a server that refuses a foreign recipient closed", async () => {
      const port = await serve(smtpScript());
      const relay = await probeOpenRelay("127.0.0.1", port);
      expect(relay.verdict).toBe("closed");
      expect(relay.reply).toContain("Relay access denied");
    });

    it("calls a server that accepts one open", async () => {
      const port = await serve(smtpScript({ acceptRcpt: true }));
      await expect(probeOpenRelay("127.0.0.1", port)).resolves.toMatchObject({ verdict: "open" });
    });

    it("says unknown rather than closed when the server cannot be reached", async () => {
      await expect(probeOpenRelay("127.0.0.1", 1)).resolves.toMatchObject({ verdict: "unknown" });
    });
  });

  describe("probeCertificate", () => {
    it("reports the failure when STARTTLS is refused instead of pretending a certificate", async () => {
      const port = await serve(smtpScript());
      const cert = await probeCertificate("127.0.0.1", "mail.example.org", port);
      expect(cert.error).toBe("STARTTLS refused");
      expect(cert.subject).toBe("");
    });

    it("reports the failure on an unreachable port", async () => {
      const cert = await probeCertificate("127.0.0.1", "mail.example.org", 1);
      expect(cert.error).toBeTruthy();
    });
  });
});
