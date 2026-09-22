import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer, connect, Socket, type AddressInfo, type Server } from "net";
import { createHmac } from "crypto";

vi.mock("tls", async (importActual) => ({ ...(await importActual<typeof import("tls")>()), connect: vi.fn() }));

import { connect as tlsConnect, type TLSSocket } from "tls";
import { DmarcImapService, ImapSession, imapQuote, xGuid } from "../../src/core/dmarc/dmarc-imap.service";

type Responder = (tag: string, command: string, socket: Socket, state: { folder: string }) => void;

function listen(respond: Responder, greeting = "* OK Dovecot ready.") {
  const commands: string[] = [];
  const server = createServer((socket) => {
    const state = { folder: "" };
    let buffer = "";
    socket.write(`${greeting}\r\n`);
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      for (let end = buffer.indexOf("\r\n"); end >= 0; end = buffer.indexOf("\r\n")) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const space = line.indexOf(" ");
        const tag = line.slice(0, space);
        const command = line.slice(space + 1);
        commands.push(command);
        respond(tag, command, socket, state);
      }
    });
  });
  return new Promise<{ server: Server; port: number; commands: string[] }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as AddressInfo).port, commands }))
  );
}

function dovecot(fetch: Record<string, string[]>, failing: string[] = []): Responder {
  return (tag, command, socket, state) => {
    if (command.startsWith("LOGIN ")) socket.write(`${tag} OK Logged in\r\n`);
    else if (command.startsWith("SELECT ")) {
      state.folder = JSON.parse(command.slice(7)) as string;
      socket.write(failing.includes(state.folder) ? `${tag} NO Mailbox doesn't exist\r\n` : `${tag} OK Select completed\r\n`);
    } else if (command === "UID FETCH 1:* (X-GUID)") {
      for (const line of fetch[state.folder] ?? []) socket.write(line);
      socket.write(`${tag} OK Fetch completed\r\n`);
    } else if (command === "LOGOUT") {
      socket.write(`* BYE Logging out\r\n${tag} OK Logout completed\r\n`);
      socket.end();
    } else socket.write(`${tag} OK done\r\n`);
  };
}

class TestImapService extends DmarcImapService {
  constructor(private readonly port: number) {
    super();
  }

  protected override open() {
    return new ImapSession(connect(this.port, "127.0.0.1"));
  }
}

describe("DmarcImapService", () => {
  const servers: Server[] = [];
  const start = async (respond: Responder, greeting?: string) => {
    const fake = await listen(respond, greeting);
    servers.push(fake.server);
    return { svc: new TestImapService(fake.port), commands: fake.commands };
  };

  beforeEach(() => vi.stubEnv("MANAGER_API_TOKEN_PEPPER", "pepper"));
  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  });

  it("logs into the reports mailbox and deletes only the messages whose file it imported, folder by folder", async () => {
    const { svc, commands } = await start(
      dovecot({
        INBOX: [
          "* 1 FETCH (UID 5 X-GUID 1789.M1.host,S=10,W=12)\r\n",
          '* 2 FETCH (UID 6 X-GUID "1789.M2.host")\r\n',
          "* 3 FETCH (UID 7 X-GUID {12}\r\n1789.M3.host)\r\n",
        ],
        "Archive/2026": ["* 1 FETCH (X-GUID 1789.M4.host UID 9)\r\n"],
      })
    );

    await expect(
      svc.expunge("DMARC_Reports@a.test", [
        { folder: "INBOX", key: "1789.M1.host,S=10,W=12" },
        { folder: "INBOX", key: "1789.M3.host" },
        { folder: "INBOX", key: "gone" },
        { folder: "Archive/2026", key: "1789.M4.host" },
      ])
    ).resolves.toBe(3);

    const password = createHmac("sha256", "pepper").update("dmarc-reports-imap:dmarc_reports@a.test").digest("hex");
    expect(commands).toEqual([
      `LOGIN "dmarc_reports@a.test" "${password}"`,
      'SELECT "INBOX"',
      "UID FETCH 1:* (X-GUID)",
      "UID STORE 5,7 +FLAGS.SILENT (\\Deleted)",
      "UID EXPUNGE 5,7",
      'SELECT "Archive/2026"',
      "UID FETCH 1:* (X-GUID)",
      "UID STORE 9 +FLAGS.SILENT (\\Deleted)",
      "UID EXPUNGE 9",
      "LOGOUT",
    ]);
  });

  it("never connects for another mailbox, without the pepper, or with nothing to delete", async () => {
    const { svc, commands } = await start(dovecot({}));
    await expect(svc.expunge("padcmoi@a.test", [{ folder: "INBOX", key: "k" }])).resolves.toBe(0);
    await expect(svc.expunge("dmarc_reports@a.test", [])).resolves.toBe(0);
    vi.stubEnv("MANAGER_API_TOKEN_PEPPER", "");
    await expect(svc.expunge("dmarc_reports@a.test", [{ folder: "INBOX", key: "k" }])).resolves.toBe(0);
    expect(commands).toEqual([]);
  });

  it("stores nothing in a folder where no file matches, and carries on past a folder it cannot open", async () => {
    const { svc, commands } = await start(
      dovecot({ INBOX: ["* 1 FETCH (UID 5 X-GUID other)\r\n"], Junk: ["* 1 FETCH (UID 8 X-GUID k2)\r\n"] }, ["Gone"])
    );
    await expect(
      svc.expunge("dmarc_reports@a.test", [
        { folder: "INBOX", key: "k1" },
        { folder: "Gone", key: "k3" },
        { folder: "Junk", key: "k2" },
      ])
    ).resolves.toBe(1);
    expect(commands.filter((command) => command.startsWith("UID STORE"))).toEqual(["UID STORE 8 +FLAGS.SILENT (\\Deleted)"]);
  });

  it("fails when the login is refused, and still hangs up", async () => {
    const { svc, commands } = await start((tag, command, socket) => {
      if (command.startsWith("LOGIN ")) socket.write(`${tag} NO [AUTHENTICATIONFAILED] Authentication failed.\r\n`);
      else dovecot({})(tag, command, socket, { folder: "" });
    });
    await expect(svc.expunge("dmarc_reports@a.test", [{ folder: "INBOX", key: "k" }])).rejects.toThrow(
      "IMAP NO [AUTHENTICATIONFAILED] Authentication failed."
    );
    expect(commands.at(-1)).toBe("LOGOUT");
  });

  it("fails on a server that refuses the connection", async () => {
    const { svc } = await start(dovecot({}), "* BYE Too many connections");
    await expect(svc.expunge("dmarc_reports@a.test", [{ folder: "INBOX", key: "k" }])).rejects.toThrow(
      "IMAP greeting refused: * BYE Too many connections"
    );
  });

  it("opens a TLS connection to Dovecot on the internal network, named after the mail host", () => {
    vi.mocked(tlsConnect).mockImplementation(() => new Socket() as TLSSocket);
    vi.stubEnv("DMARC_IMAP_HOST", "172.200.0.16");
    vi.stubEnv("DMARC_IMAP_PORT", "993");
    vi.stubEnv("MAIL_HOSTNAME", "mail.example.org");
    expect(new DmarcImapService()["open"]()).toBeInstanceOf(ImapSession);
    expect(tlsConnect).toHaveBeenLastCalledWith({
      host: "172.200.0.16",
      port: 993,
      servername: "mail.example.org",
      rejectUnauthorized: false,
    });

    vi.unstubAllEnvs();
    vi.stubEnv("MAIL_HOSTNAME", "");
    new DmarcImapService()["open"]();
    expect(tlsConnect).toHaveBeenLastCalledWith({
      host: "mail-dovecot",
      port: 993,
      servername: undefined,
      rejectUnauthorized: false,
    });
  });
});

describe("ImapSession", () => {
  let server: Server;
  let port: number;
  let peer: Promise<Socket>;

  beforeEach(async () => {
    let accept: (socket: Socket) => void = () => undefined;
    peer = new Promise((resolve) => (accept = resolve));
    server = createServer((socket) => accept(socket));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(() => new Promise((resolve) => server.close(resolve)));

  it("reassembles lines split across packets and reads empty literals", async () => {
    const session = new ImapSession(connect(port, "127.0.0.1"));
    const remote = await peer;
    remote.write("* OK re");
    remote.write("ady\r\n");
    await session.greeting();
    const lines = session.command("UID FETCH 1:* (X-GUID)");
    remote.write('* 1 FETCH (UID 3 X-GUID {0}\r\n)\r\n* 2 FETCH (UID 4 X-GUID {8}\r\nab\r\n"c\\d)\r\na1 OK\r\n');
    await expect(lines).resolves.toEqual(['* 1 FETCH (UID 3 X-GUID "")', '* 2 FETCH (UID 4 X-GUID "ab \\"c\\\\d")']);
    remote.destroy();
  });

  it("rejects the pending command when the connection drops, and every later one", async () => {
    const session = new ImapSession(connect(port, "127.0.0.1"));
    const remote = await peer;
    remote.write("* OK ready\r\n");
    await session.greeting();
    const pending = session.command("NOOP");
    remote.resume();
    remote.end();
    await expect(pending).rejects.toThrow("IMAP connection closed");
    await expect(session.command("NOOP")).rejects.toThrow("IMAP connection closed");
    await session.close();
  });

  it("gives up on a server that stays silent", async () => {
    const session = new ImapSession(connect(port, "127.0.0.1"), 50);
    await peer;
    await expect(session.greeting()).rejects.toThrow("IMAP timed out");
  });
});

describe("the IMAP helpers", () => {
  it("quotes a string and refuses a line break", () => {
    expect(imapQuote('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(() => imapQuote("a\r\nb")).toThrow("line break");
  });

  it("reads an atom, a quoted string or nothing as the X-GUID", () => {
    expect(xGuid("* 1 FETCH (UID 5 X-GUID 1789.M1.host,S=1)")).toBe("1789.M1.host,S=1");
    expect(xGuid('* 1 FETCH (X-GUID "a \\"b\\"" UID 5)')).toBe('a "b"');
    expect(xGuid("* 1 FETCH (UID 5)")).toBeNull();
  });
});
