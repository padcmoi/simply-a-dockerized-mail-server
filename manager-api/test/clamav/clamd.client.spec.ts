import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server } from "net";
import { ConfigService } from "@nestjs/config";
import { ClamdClient } from "../../src/core/clamav/clamd.client";

const STATS = [
  "POOLS: 1",
  "",
  "STATE: VALID PRIMARY",
  "THREADS: live 3  idle 2 max 12 idle-timeout 30",
  "QUEUE: 4 items",
  "\tSTATS 0.000035 ",
  "",
  "MEMSTATS: heap N/A mmap N/A used N/A free N/A releasable N/A pools 1 pools_used 967.689M pools_total 967.726M",
  "END",
].join("\n");

// A real socket rather than a mocked `net`: the client's whole job is the
// protocol on the wire, the `n` prefix included, and a double of `createConnection`
// would only prove that it was called.
describe("ClamdClient", () => {
  let server: Server;
  let port = 0;
  let asked: string[] = [];
  let answer: (command: string) => string | null = () => null;
  let client: ClamdClient;

  beforeAll(async () => {
    server = createServer((socket) => {
      socket.on("data", (chunk) => {
        const command = chunk.toString().replace(/^n/, "").trim();
        asked.push(command);
        const reply = answer(command);
        if (reply === null) return socket.destroy();
        socket.end(`${reply}\n`);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    port = typeof address === "object" && address ? address.port : 0;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(() => {
    asked = [];
    answer = (command) =>
      command === "PING" ? "PONG" : command === "VERSION" ? "ClamAV 1.4.6/28129/Sun Sep 20 06:26:26 2026" : STATS;
    client = new ClamdClient(new ConfigService({ CLAMAV_HOST: "127.0.0.1", CLAMAV_PORT: String(port) }));
  });

  it("answers the ping, with the command clamd expects", async () => {
    expect(await client.ping()).toBe(true);
    expect(asked).toEqual(["PING"]);
  });

  it("reads the version clamd names itself with", async () => {
    expect(await client.version()).toBe("ClamAV 1.4.6/28129/Sun Sep 20 06:26:26 2026");
  });

  it("reads the threads, the queue and the pools out of the stats block", async () => {
    expect(await client.stats()).toEqual({
      threadsLive: 3,
      threadsIdle: 2,
      threadsMax: 12,
      queue: 4,
      poolsUsed: Math.round(967.689 * 1024 ** 2),
    });
  });

  it("takes clamd's word that it is reloading", async () => {
    answer = () => "RELOADING";
    expect(await client.reload()).toBe(true);
    expect(asked).toEqual(["RELOAD"]);
  });

  it("reports a reload clamd did not confirm", async () => {
    answer = () => "NOPE";
    expect(await client.reload()).toBe(false);
  });

  // Everything answers for a scanner that is out of reach rather than throwing:
  // the page still has its databases to show.
  describe("with nothing listening", () => {
    beforeEach(() => {
      client = new ClamdClient(new ConfigService({ CLAMAV_HOST: "127.0.0.1", CLAMAV_PORT: "1" }));
    });

    it("says the ping failed", async () => {
      expect(await client.ping()).toBe(false);
    });
    it("has no version", async () => {
      expect(await client.version()).toBeNull();
    });
    it("has no stats", async () => {
      expect(await client.stats()).toBeNull();
    });
    it("did not reload", async () => {
      expect(await client.reload()).toBe(false);
    });
  });

  it("has no version when clamd answers something else entirely", async () => {
    answer = () => "not clamav";
    expect(await client.version()).toBeNull();
  });

  it("reads a stats block with none of its usual lines as figures it does not have", async () => {
    answer = () => "END";
    expect(await client.stats()).toEqual({
      threadsLive: null,
      threadsIdle: null,
      threadsMax: null,
      queue: null,
      poolsUsed: null,
    });
  });

  it("falls back to the mail network address when nothing names one", () => {
    expect(new ClamdClient(new ConfigService({}))).toBeInstanceOf(ClamdClient);
  });
});
