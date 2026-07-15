import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { readDomainBayes } from "../../src/core/rspamd/bayes-redis";

class FakeSocket extends EventEmitter {
  write = vi.fn();
  destroy = vi.fn();
}

// readDomainBayes opens a raw socket to Redis and speaks RESP by hand. Mock the
// "net" module so createConnection hands back a controllable EventEmitter we can
// drive with crafted reply bytes -- no socket, no Redis. Declaring the mock's
// return as FakeSocket lets the stub return one directly, with no structural
// cast to the real net.Socket.
const netMock = vi.hoisted(() => ({ createConnection: vi.fn<(...args: unknown[]) => FakeSocket>() }));
vi.mock("net", () => netMock);

// RESP encoders (client-visible replies only).
const bulk = (s: string) => `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
const smembers = (members: string[]) => `*${members.length}\r\n` + members.map(bulk).join("");
const hmget = (fields: string[]) => `*${fields.length}\r\n` + fields.join("");
const int = (n: number) => `:${n}\r\n`;
const NIL = "$-1\r\n"; // null bulk string
const NIL_ARR = "*-1\r\n"; // null array

const tick = () => new Promise<void>((r) => setImmediate(r));

let sockets: FakeSocket[];

beforeEach(() => {
  sockets = [];
  netMock.createConnection.mockImplementation(() => {
    const s = new FakeSocket();
    sockets.push(s);
    return s;
  });
});

// Lets the reader open the Nth connection, then delivers a full reply payload
// (connect fires the write, one data chunk carries the pipelined replies).
async function serve(index: number, payload: string): Promise<void> {
  await tick();
  sockets[index].emit("connect");
  sockets[index].emit("data", Buffer.from(payload));
}

describe("readDomainBayes", () => {
  it("unions both key sets, filters by domain, strips the RS prefix and parses learns", async () => {
    const p = readDomainBayes("Example.com"); // mixed case exercises the suffix lowercasing
    await serve(
      0,
      smembers(["RSuser@example.com", "RSbob@example.com", "RSalien@other.com", "RSdave@example.com"]) +
        smembers(["RSuser@example.com", "RScarol@example.com"])
    );
    // Keys after union+filter, in order: user, bob, dave, carol.
    await serve(1, hmget([int(73), int(71)]) + hmget([bulk("10"), bulk("0")]) + NIL_ARR + hmget([NIL, bulk("5")]));
    const res = await p;

    // Ranked by total learns desc; alien@other.com is filtered out.
    expect(res.recipients.map((r) => r.recipient)).toEqual([
      "user@example.com",
      "bob@example.com",
      "carol@example.com",
      "dave@example.com",
    ]);
    expect(res.recipients[0]).toEqual({ recipient: "user@example.com", learnsHam: 73, learnsSpam: 71 });
    // A null-array HMGET reply degrades to zero learns.
    expect(res.recipients.find((r) => r.recipient === "dave@example.com")).toEqual({
      recipient: "dave@example.com",
      learnsHam: 0,
      learnsSpam: 0,
    });
    expect(res.totalHam).toBe(83);
    expect(res.totalSpam).toBe(76);
    expect(netMock.createConnection).toHaveBeenCalledTimes(2);
    expect(sockets[0].write).toHaveBeenCalled();
  });

  it("counts non-numeric and null learn values as zero", async () => {
    const p = readDomainBayes("example.com");
    await serve(0, smembers(["RSx@example.com"]) + smembers([]));
    await serve(1, hmget([bulk("notanumber"), NIL]));
    const res = await p;
    expect(res.recipients).toEqual([{ recipient: "x@example.com", learnsHam: 0, learnsSpam: 0 }]);
    expect(res.totalHam).toBe(0);
    expect(res.totalSpam).toBe(0);
  });

  it("returns empty and opens no second connection when no key matches the domain", async () => {
    const p = readDomainBayes("example.com");
    // The SPAM set comes back as a null array, exercising the non-array guard.
    await serve(0, smembers(["RSuser@other.com"]) + NIL_ARR);
    const res = await p;
    expect(res).toEqual({ recipients: [], totalHam: 0, totalSpam: 0 });
    expect(netMock.createConnection).toHaveBeenCalledTimes(1);
  });

  it("degrades to empty when Redis answers the SMEMBERS with an error", async () => {
    const p = readDomainBayes("example.com");
    await serve(0, "-ERR unknown command\r\n-ERR unknown command\r\n");
    const res = await p;
    expect(res).toEqual({ recipients: [], totalHam: 0, totalSpam: 0 });
    expect(netMock.createConnection).toHaveBeenCalledTimes(1);
  });

  it("reassembles a reply delivered across multiple TCP chunks", async () => {
    const p = readDomainBayes("example.com");
    const smembersReply = smembers(["RSa@example.com"]) + smembers(["RSa@example.com"]);
    await tick();
    sockets[0].emit("connect");
    // Split mid-way through the second reply: the first chunk is an incomplete
    // pipeline, so the reader must keep buffering until the rest arrives.
    sockets[0].emit("data", Buffer.from(smembersReply.slice(0, smembersReply.length - 6)));
    sockets[0].emit("data", Buffer.from(smembersReply.slice(smembersReply.length - 6)));
    await serve(1, hmget([bulk("1"), bulk("2")]));
    const res = await p;
    expect(res.recipients).toEqual([{ recipient: "a@example.com", learnsHam: 1, learnsSpam: 2 }]);
  });

  it("rejects when the socket errors", async () => {
    const p = readDomainBayes("example.com");
    const rejects = expect(p).rejects.toThrow("ECONNREFUSED"); // attach before emitting
    await tick();
    sockets[0].emit("error", new Error("ECONNREFUSED"));
    await rejects;
    expect(sockets[0].destroy).toHaveBeenCalled();
  });

  it("rejects on the 2s timeout when Redis never answers", async () => {
    vi.useFakeTimers();
    try {
      const p = readDomainBayes("example.com");
      const rejects = expect(p).rejects.toThrow("redis timeout"); // attach before the timer fires
      await vi.advanceTimersByTimeAsync(2000);
      await rejects;
    } finally {
      vi.useRealTimers();
    }
  });
});
