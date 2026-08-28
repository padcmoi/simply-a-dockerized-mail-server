import { describe, it, expect, vi } from "vitest";
import { dnsbl, nodeState, reverseIp, type DnsQuery } from "../../src/api/domains/deliverability/deliverability.dns";
import { providerMock } from "../helpers/mocks";

// The DNS layer is where a diagnostic tells the truth or lies: these pin the
// two rules everything else rests on - a refused blocklist is never "clean",
// and a node with no record of its own still says whether anything lives
// below it.

function resolverStub(behaviour: (name: string) => Promise<unknown>) {
  return providerMock<DnsQuery>({
    resolve4: vi.fn((name: string) => behaviour(name) as Promise<string[]>),
    resolveTxt: vi.fn((name: string) => behaviour(name) as Promise<string[][]>),
  });
}

function dnsError(code: string) {
  const e = new Error(code) as NodeJS.ErrnoException;
  e.code = code;
  return e;
}

describe("deliverability DNS layer", () => {
  describe("reverseIp", () => {
    it("reverses the octets the way a DNSBL is queried", () => {
      expect(reverseIp("51.77.200.97")).toBe("97.200.77.51");
    });
  });

  describe("dnsbl", () => {
    it("reports a listing with the codes the list answered", async () => {
      const r = resolverStub(async () => ["127.0.0.2", "127.0.0.4"]);
      await expect(dnsbl(r, "1.2.3.4", "zen.example")).resolves.toEqual({
        verdict: "listed",
        codes: ["127.0.0.2", "127.0.0.4"],
      });
    });

    it("reports clean only on NXDOMAIN, which is what clean means in a DNSBL", async () => {
      const r = resolverStub(async () => {
        throw dnsError("ENOTFOUND");
      });
      await expect(dnsbl(r, "1.2.3.4", "zen.example")).resolves.toMatchObject({ verdict: "clean" });
    });

    // Spamhaus answers 127.255.255.x to a public resolver to say "I refuse to
    // answer you". Turning that into a green tick would make the whole page a
    // lie, so it is reported as unavailable.
    it("never turns a refusal to answer into a clean verdict", async () => {
      const r = resolverStub(async () => ["127.255.255.254"]);
      await expect(dnsbl(r, "1.2.3.4", "zen.example")).resolves.toMatchObject({ verdict: "unavailable" });
    });

    it("reports a timeout as unavailable, not clean", async () => {
      const r = resolverStub(async () => {
        throw dnsError("ETIMEOUT");
      });
      await expect(dnsbl(r, "1.2.3.4", "zen.example")).resolves.toMatchObject({ verdict: "unavailable" });
    });
  });

  describe("nodeState", () => {
    it("says a node exists when it answers records", async () => {
      const r = resolverStub(async () => [["v=DKIM1; p=AAA"]]);
      await expect(nodeState(r, "_domainkey.example.org")).resolves.toBe("exists");
    });

    // The whole point: `_domainkey` holds no TXT of its own, but answering
    // ENODATA instead of ENOTFOUND is what says selectors live below it.
    it("says a node exists when it holds no record but has children", async () => {
      const r = resolverStub(async () => {
        throw dnsError("ENODATA");
      });
      await expect(nodeState(r, "_domainkey.example.org")).resolves.toBe("exists");
    });

    it("says empty only on NXDOMAIN, which is what proves there is no key at all", async () => {
      const r = resolverStub(async () => {
        throw dnsError("ENOTFOUND");
      });
      await expect(nodeState(r, "_domainkey.example.org")).resolves.toBe("empty");
    });

    it("says unknown when the lookup itself failed", async () => {
      const r = resolverStub(async () => {
        throw dnsError("ESERVFAIL");
      });
      await expect(nodeState(r, "_domainkey.example.org")).resolves.toBe("unknown");
    });
  });
});
