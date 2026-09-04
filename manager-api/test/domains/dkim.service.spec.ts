import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Repository } from "typeorm";
import { DkimService } from "../../src/core/dkim/dkim.service";
import { DkimKeyEntity } from "../../src/core/entities/dkim-key.entity";
import { type Loose, providerMock, repoMock } from "../helpers/mocks";

const BASE = "http://sidecar:9000";

// A fetch Response double: the service only touches .ok, .status and .json().
function res(opts: { ok?: boolean; status?: number; json?: () => unknown }) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: opts.json ?? (async () => ({})),
  };
}
const okJson = (body: unknown) => res({ ok: true, status: 200, json: async () => body });

describe("DkimService (OpenDKIM sidecar over global fetch)", () => {
  const fetchMock = vi.fn();
  let repo: Loose<Repository<DkimKeyEntity>>;
  let svc: DkimService;

  beforeAll(() => vi.stubGlobal("fetch", fetchMock));
  afterAll(() => vi.unstubAllGlobals());

  beforeEach(() => {
    fetchMock.mockReset();
    repo = repoMock<DkimKeyEntity>();
    repo.upsert.mockResolvedValue(undefined);
    repo.delete.mockResolvedValue(undefined);
    const cfg = providerMock<ConfigService>({ get: vi.fn().mockReturnValue(BASE) });
    svc = new DkimService(cfg, repo);
  });

  describe("constructor", () => {
    it("falls back to the default sidecar URL when OPENDKIM_API_URL is unset", async () => {
      const cfg = providerMock<ConfigService>({ get: vi.fn().mockReturnValue(undefined) });
      const local = new DkimService(cfg, repo);
      repo.find.mockResolvedValue([]);
      fetchMock.mockResolvedValueOnce(okJson({ keys: [] }));
      await local.list("example.com");
      expect(fetchMock.mock.calls[0][0]).toBe("http://mail-opendkim:8080/keys/example.com");
    });
  });

  describe("list", () => {
    it("returns persisted rows mapped to DkimKey without touching the sidecar", async () => {
      repo.find.mockResolvedValue([
        {
          domain: "example.com",
          selector: "dkim202601",
          dnsName: "dkim202601._domainkey",
          txtRecord: "v=DKIM1; p=ABC",
          publicKey: "ABC",
        },
      ]);
      const out = await svc.list("example.com");
      expect(repo.find).toHaveBeenCalledWith({ where: { domain: "example.com" }, order: { selector: "ASC" } });
      expect(out).toEqual([
        { domain: "example.com", selector: "dkim202601", dnsName: "dkim202601._domainkey", txtRecord: "v=DKIM1; p=ABC" },
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("self-heals from the sidecar and persists when the table is empty", async () => {
      repo.find.mockResolvedValue([]);
      const key = {
        domain: "example.com",
        selector: "dkim202602",
        dnsName: "dkim202602._domainkey",
        txtRecord: "v=DKIM1; p=XYZ",
      };
      fetchMock.mockResolvedValueOnce(okJson({ keys: [key] }));
      const out = await svc.list("example.com");
      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/keys/example.com`, expect.objectContaining({ method: "GET" }));
      expect(repo.upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            domain: "example.com",
            selector: "dkim202602",
            publicKey: "XYZ",
            txtRecord: "v=DKIM1; p=XYZ",
          }),
        ],
        ["domain", "selector"]
      );
      expect(out).toEqual([key]);
    });

    it("extracts an empty public key when the txt record has no p= segment", async () => {
      repo.find.mockResolvedValue([]);
      const key = { domain: "example.com", selector: "dkim202602", dnsName: "n", txtRecord: "v=DKIM1; k=rsa" };
      fetchMock.mockResolvedValueOnce(okJson({ keys: [key] }));
      await svc.list("example.com");
      expect(repo.upsert).toHaveBeenCalledWith([expect.objectContaining({ publicKey: "" })], ["domain", "selector"]);
    });

    it("returns [] and skips persist when the sidecar reports no keys", async () => {
      repo.find.mockResolvedValue([]);
      fetchMock.mockResolvedValueOnce(okJson({}));
      const out = await svc.list("example.com");
      expect(out).toEqual([]);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it("returns [] when the sidecar body is not JSON (ok branch)", async () => {
      repo.find.mockResolvedValue([]);
      fetchMock.mockResolvedValueOnce(
        res({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("no json");
          },
        })
      );
      await expect(svc.list("example.com")).resolves.toEqual([]);
    });

    it("swallows a sidecar HTTP error and returns []", async () => {
      repo.find.mockResolvedValue([]);
      fetchMock.mockResolvedValueOnce(
        res({
          ok: false,
          status: 502,
          json: async () => {
            throw new Error("no json");
          },
        })
      );
      await expect(svc.list("example.com")).resolves.toEqual([]);
    });
  });

  describe("create", () => {
    it("POSTs with an empty body when no selector is given and persists the result", async () => {
      const key = { domain: "example.com", selector: "dkim202607", dnsName: "n", txtRecord: "v=DKIM1; p=NEW" };
      fetchMock.mockResolvedValueOnce(okJson(key));
      const out = await svc.create("example.com");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE}/keys/example.com`);
      expect(init.method).toBe("POST");
      expect(init.body).toBe("{}");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(repo.upsert).toHaveBeenCalled();
      expect(out).toEqual(key);
    });

    it("POSTs the requested selector when provided", async () => {
      const key = { domain: "example.com", selector: "custom", dnsName: "n", txtRecord: "v=DKIM1; p=NEW" };
      fetchMock.mockResolvedValueOnce(okJson(key));
      await svc.create("example.com", "custom");
      expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ selector: "custom" }));
    });

    it("raises an HttpException carrying the sidecar error + status", async () => {
      fetchMock.mockResolvedValueOnce(res({ ok: false, status: 400, json: async () => ({ error: "boom" }) }));
      const err = (await svc.create("example.com").catch((e) => e)) as HttpException;
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(400);
      expect(err.message).toBe("boom");
    });

    it("falls back to a synthetic message when the error body is not JSON", async () => {
      fetchMock.mockResolvedValueOnce(
        res({
          ok: false,
          status: 503,
          json: async () => {
            throw new Error("no json");
          },
        })
      );
      const err = (await svc.create("example.com").catch((e) => e)) as HttpException;
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(503);
      expect(err.message).toContain("dkim-api POST");
    });
  });

  describe("remove", () => {
    it("DELETEs on the sidecar and clears the persisted row", async () => {
      const result = {
        domain: "example.com",
        selector: "dkim202601",
        removedFiles: [],
        removedKeyTable: 1,
        removedSigningTable: 1,
      };
      fetchMock.mockResolvedValueOnce(okJson(result));
      const out = await svc.remove("example.com", "dkim202601");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE}/keys/example.com?selector=dkim202601`);
      expect(init.method).toBe("DELETE");
      expect(repo.delete).toHaveBeenCalledWith({ domain: "example.com", selector: "dkim202601" });
      expect(out).toEqual(result);
    });
  });

  describe("removeAll", () => {
    it("removes each listed key then hard-deletes any residue row", async () => {
      repo.find.mockResolvedValue([
        { domain: "example.com", selector: "s1", dnsName: "n1", txtRecord: "v=DKIM1; p=A", publicKey: "A" },
        { domain: "example.com", selector: "s2", dnsName: "n2", txtRecord: "v=DKIM1; p=B", publicKey: "B" },
      ]);
      fetchMock.mockResolvedValue(okJson({}));
      await svc.removeAll("example.com");
      expect(repo.delete).toHaveBeenCalledWith({ domain: "example.com", selector: "s1" });
      expect(repo.delete).toHaveBeenCalledWith({ domain: "example.com", selector: "s2" });
      expect(repo.delete).toHaveBeenCalledWith({ domain: "example.com" });
    });

    it("still hard-deletes when listing throws", async () => {
      repo.find.mockRejectedValue(new Error("db down"));
      await svc.removeAll("example.com");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith({ domain: "example.com" });
    });
  });
});
