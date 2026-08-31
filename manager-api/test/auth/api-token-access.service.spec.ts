import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { Like } from "typeorm";
import { ApiTokenAccessService } from "../../src/core/auth/api-token/api-token-access.service";
import type { ApiToken } from "../../src/core/auth/api-token/api-token.entity";
import type { ApiTokenAccess } from "../../src/core/auth/api-token/api-token-access.entity";
import { entity, repoMock } from "../helpers/mocks";

const ENTRY = {
  clientId: "cid",
  method: "GET",
  route: "/api/v1/domains?limit=10",
  statusCode: 200,
  clientIp: "203.0.113.10",
  userAgent: "python-requests/2.32.3",
  origin: "",
  referer: "",
  durationMs: 42,
};

const query = (over: Partial<{ limit: number; offset: number; search: string; sortBy: string; sortDir: "asc" | "desc" }> = {}) => ({
  offset: 0,
  sortDir: "desc" as const,
  ...over,
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("ApiTokenAccessService", () => {
  let trail: ReturnType<typeof repoMock<ApiTokenAccess>>;
  let tokens: ReturnType<typeof repoMock<ApiToken>>;
  let svc: ApiTokenAccessService;

  beforeEach(() => {
    trail = repoMock<ApiTokenAccess>();
    tokens = repoMock<ApiToken>();
    tokens.findOne.mockResolvedValue(entity<ApiToken>({ id: 7, accountId: "acc-1", clientId: "cid" }));
    trail.findAndCount.mockResolvedValue([[], 0]);
    svc = new ApiTokenAccessService(trail, tokens);
  });

  afterEach(() => {
    delete process.env.MANAGER_API_TOKEN_ACCESS_RETENTION_DAYS;
  });

  describe("record", () => {
    it("stores the request against the token the key belongs to", async () => {
      svc.record(ENTRY);
      await flush();

      expect(tokens.findOne).toHaveBeenCalledWith({ where: { clientId: "cid" }, select: { id: true } });
      expect(trail.insert).toHaveBeenCalledWith(expect.objectContaining({ tokenId: 7, method: "GET", statusCode: 200 }));
    });

    it("stores a refused request too", async () => {
      svc.record({ ...ENTRY, statusCode: 401 });
      await flush();

      expect(trail.insert).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it("drops a key no token carries", async () => {
      tokens.findOne.mockResolvedValueOnce(null);
      svc.record(ENTRY);
      await flush();

      expect(trail.insert).not.toHaveBeenCalled();
    });

    it("truncates what would not fit its column", async () => {
      svc.record({ ...ENTRY, route: "/".padEnd(900, "a"), userAgent: "x".repeat(900) });
      await flush();

      const row = trail.insert.mock.calls[0]?.[0] as { route: string; userAgent: string };
      expect(row.route).toHaveLength(512);
      expect(row.userAgent).toHaveLength(512);
    });

    it("never rejects when the write fails", async () => {
      trail.insert.mockRejectedValueOnce(new Error("database is gone"));
      expect(() => svc.record(ENTRY)).not.toThrow();
      await flush();
    });
  });

  describe("retention", () => {
    it("sweeps rows past the retention window on the first write", async () => {
      process.env.MANAGER_API_TOKEN_ACCESS_RETENTION_DAYS = "30";

      svc.record(ENTRY);
      await flush();

      const cutoff = (trail.delete.mock.calls[0]?.[0] as { createdAt: { value: Date } }).createdAt.value;
      expect(Date.now() - cutoff.getTime()).toBeCloseTo(30 * 86_400_000, -4);
    });

    it("keeps 90 days when nothing is configured", async () => {
      svc.record(ENTRY);
      await flush();

      const cutoff = (trail.delete.mock.calls[0]?.[0] as { createdAt: { value: Date } }).createdAt.value;
      expect(Date.now() - cutoff.getTime()).toBeCloseTo(90 * 86_400_000, -4);
    });

    it("does not sweep again on the next write", async () => {
      svc.record(ENTRY);
      await flush();
      svc.record(ENTRY);
      await flush();

      expect(trail.insert).toHaveBeenCalledTimes(2);
      expect(trail.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("list", () => {
    it("404s on a token belonging to someone else", async () => {
      tokens.findOne.mockResolvedValueOnce(null);
      await expect(svc.list("acc-2", 7, query())).rejects.toThrow(NotFoundException);
      expect(trail.findAndCount).not.toHaveBeenCalled();
    });

    it("reads only that token's rows, newest first", async () => {
      await svc.list("acc-1", 7, query({ limit: 10, offset: 20 }));

      expect(trail.findAndCount).toHaveBeenCalledWith({
        where: { tokenId: 7 },
        order: { createdAt: "DESC" },
        skip: 20,
        take: 10,
      });
    });

    it("falls back to createdAt when asked to sort on a column that is not one", async () => {
      await svc.list("acc-1", 7, query({ sortBy: "secretHash", sortDir: "asc" }));

      expect(trail.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: "ASC" } }));
    });

    it("sorts on a whitelisted column", async () => {
      await svc.list("acc-1", 7, query({ sortBy: "durationMs", sortDir: "asc" }));

      expect(trail.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { durationMs: "ASC" } }));
    });

    it("searches across route, address, agent, origin and verb, each scoped to the token", async () => {
      await svc.list("acc-1", 7, query({ search: "domains" }));

      expect(trail.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            { tokenId: 7, route: Like("%domains%") },
            { tokenId: 7, clientIp: Like("%domains%") },
            { tokenId: 7, userAgent: Like("%domains%") },
            { tokenId: 7, origin: Like("%domains%") },
            { tokenId: 7, method: Like("%domains%") },
          ],
        })
      );
    });

    it("names the country each address was seen from, and nothing on a private one", async () => {
      trail.findAndCount.mockResolvedValueOnce([
        [
          entity<ApiTokenAccess>({ id: "1", tokenId: 7, clientIp: "8.8.8.8" }),
          entity<ApiTokenAccess>({ id: "2", tokenId: 7, clientIp: "192.168.1.10" }),
        ],
        2,
      ]);

      const result = await svc.list("acc-1", 7, query({ limit: 25 }));

      expect(result.items[0]).toMatchObject({ clientIp: "8.8.8.8", country: "US" });
      expect(result.items[1]).toMatchObject({ clientIp: "192.168.1.10", country: "" });
    });

    it("returns the page and the total", async () => {
      trail.findAndCount.mockResolvedValueOnce([[entity<ApiTokenAccess>({ id: "1", tokenId: 7 })], 4927]);
      const result = await svc.list("acc-1", 7, query({ limit: 25 }));

      expect(result.total).toBe(4927);
      expect(result.items).toHaveLength(1);
    });
  });
});
