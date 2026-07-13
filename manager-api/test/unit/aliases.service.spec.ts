import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { Like } from "typeorm";
import { AliasesService } from "../../src/api/domains/aliases/aliases.service";
import { ApiError } from "../../src/core/common/api-error";
import type { PaginationQuery } from "../../src/core/common/pagination.validation";

// One mock per constructor arg: the alias repo and the domain repo. Only the
// methods the service actually calls are stubbed.
function makeAliasRepo() {
  return {
    find: vi.fn(),
    findAndCount: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((x: Record<string, unknown>) => x),
    save: vi.fn((x: Record<string, unknown>) => Promise.resolve({ id: 1, ...x })),
    remove: vi.fn((x: Record<string, unknown>) => Promise.resolve(x)),
  };
}
function makeDomainRepo() {
  return { findOne: vi.fn() };
}

const q = (over: Partial<PaginationQuery> = {}): PaginationQuery => ({ offset: 0, sortDir: "desc", ...over }) as PaginationQuery;

describe("AliasesService", () => {
  let aliases: ReturnType<typeof makeAliasRepo>;
  let domains: ReturnType<typeof makeDomainRepo>;
  let svc: AliasesService;

  beforeEach(() => {
    aliases = makeAliasRepo();
    domains = makeDomainRepo();
    svc = new AliasesService(aliases as never, domains as never);
  });

  describe("resolveDomain", () => {
    it("returns the domain string when the row exists", async () => {
      domains.findOne.mockResolvedValue({ id: 3, domain: "example.test" });
      await expect(svc.resolveDomain(3)).resolves.toBe("example.test");
      expect(domains.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
    });

    it("throws NotFoundException when the domain is missing", async () => {
      domains.findOne.mockResolvedValue(null);
      await expect(svc.resolveDomain(9)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("list", () => {
    it("returns the full ordered list when no limit (legacy path)", async () => {
      aliases.find.mockResolvedValue([{ id: 1 }]);
      const res = await svc.list("example.test", q());
      expect(aliases.find).toHaveBeenCalledWith({ where: { domain: "example.test" }, order: { source: "ASC" } });
      expect(res).toEqual([{ id: 1 }]);
    });

    it("paginates with the default sort column when sortBy is absent", async () => {
      aliases.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);
      const res = await svc.list("example.test", q({ limit: 10, offset: 0 }));
      expect(res).toEqual({ items: [{ id: 1 }], total: 1 });
      const arg = aliases.findAndCount.mock.calls[0][0];
      expect(arg.where).toEqual({ domain: "example.test" });
      expect(arg.order).toEqual({ id: "DESC" });
      expect(arg.take).toBe(10);
      expect(arg.skip).toBe(0);
    });

    it("honours a whitelisted sortBy in ascending order", async () => {
      aliases.findAndCount.mockResolvedValue([[], 0]);
      await svc.list("example.test", q({ limit: 25, offset: 5, sortBy: "source", sortDir: "asc" }));
      const arg = aliases.findAndCount.mock.calls[0][0];
      expect(arg.order).toEqual({ source: "ASC" });
      expect(arg.take).toBe(25);
      expect(arg.skip).toBe(5);
    });

    it("falls back to the default column on an unknown sortBy", async () => {
      aliases.findAndCount.mockResolvedValue([[], 0]);
      await svc.list("example.test", q({ limit: 10, offset: 0, sortBy: "bogus", sortDir: "asc" }));
      expect(aliases.findAndCount.mock.calls[0][0].order).toEqual({ id: "ASC" });
    });

    it("builds an OR search across source + destination when search is present", async () => {
      aliases.findAndCount.mockResolvedValue([[], 0]);
      await svc.list("example.test", q({ limit: 10, offset: 0, search: "foo" }));
      const where = aliases.findAndCount.mock.calls[0][0].where as Array<Record<string, unknown>>;
      expect(where).toHaveLength(2);
      expect(where[0]).toEqual({ domain: "example.test", source: Like("%foo%") });
      expect(where[1]).toEqual({ domain: "example.test", destination: Like("%foo%") });
    });
  });

  describe("get", () => {
    it("returns the row scoped to id + domain", async () => {
      const row = { id: 5, domain: "example.test" };
      aliases.findOne.mockResolvedValue(row);
      await expect(svc.get(5, "example.test")).resolves.toBe(row);
      expect(aliases.findOne).toHaveBeenCalledWith({ where: { id: 5, domain: "example.test" } });
    });

    it("throws an ApiError(NOT_FOUND) when absent", async () => {
      aliases.findOne.mockResolvedValue(null);
      await expect(svc.get(5, "example.test")).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("create", () => {
    it("composes the source from local-part + route domain and saves it", async () => {
      aliases.findOne.mockResolvedValue(null); // source is free
      await svc.create({ localPart: "sales", destination: "team@example.test" }, "example.test");
      expect(aliases.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "sales@example.test",
          destination: "team@example.test",
          domain: "example.test",
          userStartDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          userEndDate: null,
        })
      );
      expect(aliases.save).toHaveBeenCalled();
    });

    it("passes an explicit userEndDate through", async () => {
      aliases.findOne.mockResolvedValue(null);
      await svc.create({ localPart: "sales", destination: "team@example.test", userEndDate: "2030-01-01" }, "example.test");
      expect(aliases.create).toHaveBeenCalledWith(expect.objectContaining({ userEndDate: "2030-01-01" }));
    });

    it("throws an ApiError(CONFLICT) when the source already exists", async () => {
      aliases.findOne.mockResolvedValue({ id: 1, source: "sales@example.test" });
      await expect(svc.create({ localPart: "sales", destination: "team@example.test" }, "example.test")).rejects.toBeInstanceOf(ApiError);
      expect(aliases.save).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("rewrites the source (from the route domain) when localPart changes", async () => {
      aliases.findOne
        .mockResolvedValueOnce({ id: 5, source: "old@example.test", destination: "a@b.com", domain: "example.test" }) // get()
        .mockResolvedValueOnce(null); // assertSourceFree() -> free
      await svc.update(5, { localPart: "new" }, "example.test");
      expect(aliases.save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, source: "new@example.test" }));
      // the free-check excludes the row's own id
      const freeCheck = aliases.findOne.mock.calls[1][0].where;
      expect(freeCheck.source).toBe("new@example.test");
      expect((freeCheck.id as { value: number }).value).toBe(5);
    });

    it("throws an ApiError(CONFLICT) when the renamed source is taken by another row", async () => {
      aliases.findOne
        .mockResolvedValueOnce({ id: 5, source: "old@example.test", domain: "example.test" })
        .mockResolvedValueOnce({ id: 9, source: "new@example.test" });
      await expect(svc.update(5, { localPart: "new" }, "example.test")).rejects.toBeInstanceOf(ApiError);
      expect(aliases.save).not.toHaveBeenCalled();
    });

    it("updates only the destination without touching the source", async () => {
      aliases.findOne.mockResolvedValueOnce({ id: 5, source: "keep@example.test", destination: "old@b.com", domain: "example.test" });
      await svc.update(5, { destination: "new@b.com" }, "example.test");
      expect(aliases.save).toHaveBeenCalledWith(expect.objectContaining({ source: "keep@example.test", destination: "new@b.com" }));
      expect(aliases.findOne).toHaveBeenCalledTimes(1); // no free-check when source is untouched
    });

    it("updates the userEndDate when provided", async () => {
      aliases.findOne.mockResolvedValueOnce({ id: 5, source: "keep@example.test", userEndDate: null, domain: "example.test" });
      await svc.update(5, { userEndDate: "2031-06-01" }, "example.test");
      expect(aliases.save).toHaveBeenCalledWith(expect.objectContaining({ userEndDate: "2031-06-01" }));
    });

    it("throws an ApiError(NOT_FOUND) when the alias does not exist", async () => {
      aliases.findOne.mockResolvedValue(null);
      await expect(svc.update(5, { destination: "x@y.com" }, "example.test")).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("remove", () => {
    it("removes the resolved row and returns { ok: true }", async () => {
      const row = { id: 5, domain: "example.test" };
      aliases.findOne.mockResolvedValue(row);
      const res = await svc.remove(5, "example.test");
      expect(aliases.remove).toHaveBeenCalledWith(row);
      expect(res).toEqual({ ok: true });
    });

    it("throws an ApiError(NOT_FOUND) when absent", async () => {
      aliases.findOne.mockResolvedValue(null);
      await expect(svc.remove(5, "example.test")).rejects.toBeInstanceOf(ApiError);
      expect(aliases.remove).not.toHaveBeenCalled();
    });
  });
});
