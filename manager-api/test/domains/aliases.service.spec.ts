import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { AliasesService } from "../../src/api/domains/aliases/aliases.service";
import { ApiError } from "../../src/core/common/api-error";
import type { PaginationQuery } from "../../src/core/common/pagination.validation";
import { Account } from "../../src/core/entities/account.entity";
import { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { repoMock } from "../helpers/mocks";

// One typed double per constructor arg: the alias repo and the domain repo.
// repoMock stubs every repository method, so the service constructor stays
// type-checked without a cast.
// Chainable QueryBuilder double for the paginated `list`, which joins the
// owning account. Every builder step returns the same object; terminals carry
// empty defaults a test overrides when it asserts on rows.
function makeQb() {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["leftJoin", "addSelect", "where", "andWhere", "orderBy", "skip", "take"]) {
    qb[m] = vi.fn(() => qb);
  }
  qb.getCount = vi.fn(async () => 0);
  qb.getRawAndEntities = vi.fn(async () => ({ entities: [], raw: [] }));
  return qb;
}

function makeAliasRepo(qb: ReturnType<typeof makeQb>) {
  const repo = repoMock<VirtualAlias>();
  // The DB assigns the id on insert; mirror that so a saved row carries one.
  repo.save.mockImplementation(async (x: object) => ({ id: 1, ...x }));
  repo.createQueryBuilder.mockReturnValue(qb);
  return repo;
}
function makeDomainRepo() {
  return repoMock<VirtualDomain>();
}
function makeAccountRepo() {
  return repoMock<Account>();
}

const q = (over: Partial<PaginationQuery> = {}): PaginationQuery => ({ offset: 0, sortDir: "desc", ...over });

describe("AliasesService", () => {
  let aliases: ReturnType<typeof makeAliasRepo>;
  let domains: ReturnType<typeof makeDomainRepo>;
  let accounts: ReturnType<typeof makeAccountRepo>;
  let qb: ReturnType<typeof makeQb>;
  let svc: AliasesService;

  beforeEach(() => {
    qb = makeQb();
    aliases = makeAliasRepo(qb);
    domains = makeDomainRepo();
    accounts = makeAccountRepo();
    svc = new AliasesService(aliases, domains, accounts);
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
      qb.getCount.mockResolvedValueOnce(1);
      qb.getRawAndEntities.mockResolvedValueOnce({ entities: [{ id: 1 }], raw: [{}] });

      const res = await svc.list("example.test", q({ limit: 10, offset: 0 }));

      expect(res).toEqual({ items: [{ id: 1, ownerEmail: null }], total: 1 });
      expect(qb.where).toHaveBeenCalledWith("a.domain = :domain", { domain: "example.test" });
      expect(qb.orderBy).toHaveBeenCalledWith("a.id", "DESC");
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.skip).toHaveBeenCalledWith(0);
    });

    it("honours a whitelisted sortBy in ascending order", async () => {
      await svc.list("example.test", q({ limit: 25, offset: 5, sortBy: "source", sortDir: "asc" }));
      expect(qb.orderBy).toHaveBeenCalledWith("a.source", "ASC");
      expect(qb.take).toHaveBeenCalledWith(25);
      expect(qb.skip).toHaveBeenCalledWith(5);
    });

    it("falls back to the default column on an unknown sortBy", async () => {
      await svc.list("example.test", q({ limit: 10, offset: 0, sortBy: "bogus", sortDir: "asc" }));
      expect(qb.orderBy).toHaveBeenCalledWith("a.id", "ASC");
    });

    // The owner lives in `accounts`, not in `virtual_aliases`, so the sort has
    // to reach the joined address rather than the `owner_id` uuid the row
    // carries.
    it("sorts on the joined owner address when sortBy is ownerEmail", async () => {
      await svc.list("example.test", q({ limit: 10, offset: 0, sortBy: "ownerEmail", sortDir: "asc" }));
      expect(qb.orderBy).toHaveBeenCalledWith("ownerEmail", "ASC");
      expect(qb.orderBy).not.toHaveBeenCalledWith("a.ownerEmail", "ASC");
    });

    it("searches across source, destination and the owner address", async () => {
      await svc.list("example.test", q({ limit: 10, offset: 0, search: "foo" }));
      expect(qb.andWhere).toHaveBeenCalledWith(
        "(a.source LIKE :search OR a.destination LIKE :search OR o.email LIKE :search)",
        { search: "%foo%" }
      );
    });

    it("leaves the query unfiltered when no search term is given", async () => {
      await svc.list("example.test", q({ limit: 10, offset: 0 }));
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it("carries the joined owner address onto each row, null when the alias belongs to nobody", async () => {
      qb.getCount.mockResolvedValueOnce(2);
      qb.getRawAndEntities.mockResolvedValueOnce({
        entities: [{ id: 1 }, { id: 2 }],
        raw: [{ ownerEmail: "owner@example.test" }, {}],
      });

      const res = await svc.list("example.test", q({ limit: 10, offset: 0 }));

      expect(res).toEqual({
        items: [
          { id: 1, ownerEmail: "owner@example.test" },
          { id: 2, ownerEmail: null },
        ],
        total: 2,
      });
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

  describe("assignOwner / clearOwner", () => {
    it("assigns an unassigned alias after checking the account exists", async () => {
      aliases.findOne.mockResolvedValue({ id: 7, domain: "example.test", ownerId: null, source: "a@example.test" });
      accounts.findOne.mockResolvedValue({ id: "acc-1" });
      const saved = await svc.assignOwner(7, "example.test", "acc-1");
      expect(accounts.findOne).toHaveBeenCalledWith({ where: { id: "acc-1" } });
      expect(saved.ownerId).toBe("acc-1");
    });

    it("409s (alreadyAssigned) when the alias already has an owner", async () => {
      aliases.findOne.mockResolvedValue({ id: 7, domain: "example.test", ownerId: "other", source: "a@example.test" });
      await expect(svc.assignOwner(7, "example.test", "acc-1")).rejects.toBeInstanceOf(ApiError);
      expect(aliases.save).not.toHaveBeenCalled();
    });

    it("403s (postmasterUnassignable) and never touches accounts for the postmaster alias", async () => {
      aliases.findOne.mockResolvedValue({ id: 7, domain: "example.test", ownerId: null, source: "postmaster@example.test" });
      const e = await svc.assignOwner(7, "example.test", "acc-1").catch((x: unknown) => x);
      expect((e as ApiError).getStatus()).toBe(403);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "aliases.postmasterUnassignable" });
      expect(accounts.findOne).not.toHaveBeenCalled();
      expect(aliases.save).not.toHaveBeenCalled();
    });

    it("404s when the target account does not exist", async () => {
      aliases.findOne.mockResolvedValue({ id: 7, domain: "example.test", ownerId: null, source: "a@example.test" });
      accounts.findOne.mockResolvedValue(null);
      await expect(svc.assignOwner(7, "example.test", "ghost")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("clearOwner releases the owner without touching accounts", async () => {
      aliases.findOne.mockResolvedValue({ id: 7, domain: "example.test", ownerId: "acc-1", source: "a@example.test" });
      const saved = await svc.clearOwner(7, "example.test");
      expect(accounts.findOne).not.toHaveBeenCalled();
      expect(saved.ownerId).toBeNull();
    });

    it("getWithOwner returns the owning account email", async () => {
      aliases.findOne.mockResolvedValue({ id: 7, domain: "example.test", ownerId: "acc-1", source: "a@example.test" });
      accounts.findOne.mockResolvedValue({ email: "owner@example.test" });
      const res = await svc.getWithOwner(7, "example.test");
      expect(res.ownerEmail).toBe("owner@example.test");
    });
  });
});
