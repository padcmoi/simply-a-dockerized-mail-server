import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { DomainsService } from "../../src/api/domains/domains.service";

// sha512crypt shells out to `openssl` (child_process); the postmaster-reservation
// branch must not spawn a real process, so the whole module is stubbed.
vi.mock("../../src/core/common/sha512-crypt", () => ({
  sha512crypt: vi.fn().mockResolvedValue("$6$salt$hash"),
}));

// `disk()` is the only caller of statfs; keep every other fs/promises export
// real so nothing else in the import graph loses a function it needs.
vi.mock("fs/promises", async (importActual) => {
  const actual = await importActual<typeof import("fs/promises")>();
  return { ...actual, statfs: vi.fn() };
});
import { statfs } from "fs/promises";
const statfsMock = vi.mocked(statfs);

// One mock per constructor arg, in order:
// repo, users, accounts, quotaDomains, dkim, auditLog, storage. Only the methods
// the service actually calls are present, each a vi.fn so calls are assertable.
function makeMocks() {
  return {
    repo: {
      find: vi.fn(),
      findAndCount: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn((x: Record<string, unknown>) => x),
      save: vi.fn((x: Record<string, unknown>) => Promise.resolve(x)),
      remove: vi.fn().mockResolvedValue(undefined),
      createQueryBuilder: vi.fn(),
    },
    users: {
      findOne: vi.fn(),
      create: vi.fn((x: Record<string, unknown>) => x),
      save: vi.fn((x: Record<string, unknown>) => Promise.resolve(x)),
    },
    accounts: {
      findBy: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
    },
    quotaDomains: {
      find: vi.fn().mockResolvedValue([]),
    },
    dkim: {
      create: vi.fn(),
      removeAll: vi.fn().mockResolvedValue(undefined),
    },
    auditLog: {
      record: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      removeDomain: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("DomainsService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: DomainsService;

  beforeEach(() => {
    m = makeMocks();
    svc = new DomainsService(
      m.repo as never,
      m.users as never,
      m.accounts as never,
      m.quotaDomains as never,
      m.dkim as never,
      m.auditLog as never,
      m.storage as never
    );
  });

  describe("list (legacy, unpaginated)", () => {
    it("scopes to every row when canSeeAll and enriches owner email + used bytes", async () => {
      m.repo.find.mockResolvedValueOnce([{ id: 1, domain: "a.com", ownerId: "acc1" }]);
      m.accounts.findBy.mockResolvedValueOnce([{ id: "acc1", email: "owner@a.com" }]);
      m.quotaDomains.find.mockResolvedValueOnce([{ domain: "a.com", bytes: "512" }]);

      const res = await svc.list({} as never, { callerId: "acc1", canSeeAll: true });

      expect(m.repo.find).toHaveBeenCalledWith({ where: {}, order: { domain: "ASC" } });
      expect(res).toEqual([
        { id: 1, domain: "a.com", ownerId: "acc1", ownerEmail: "owner@a.com", usedBytes: "512" },
      ]);
    });

    it("scopes to owned rows only when not canSeeAll", async () => {
      m.repo.find.mockResolvedValueOnce([]);
      await svc.list({} as never, { callerId: "me", canSeeAll: false });
      expect(m.repo.find).toHaveBeenCalledWith({ where: { ownerId: "me" }, order: { domain: "ASC" } });
    });

    it("falls back to null owner email (owner missing or null) and 0 bytes when no quota row", async () => {
      m.repo.find.mockResolvedValueOnce([
        { id: 1, domain: "a.com", ownerId: "gone" }, // account row not returned
        { id: 2, domain: "b.com", ownerId: null }, // no owner at all
      ]);
      m.accounts.findBy.mockResolvedValueOnce([]);
      m.quotaDomains.find.mockResolvedValueOnce([]);

      const res = (await svc.list({} as never, { callerId: "x", canSeeAll: true })) as Array<Record<string, unknown>>;

      expect(m.accounts.findBy).toHaveBeenCalledTimes(1); // one non-null ownerId -> lookup happened
      expect(res[0]).toMatchObject({ ownerEmail: null, usedBytes: "0" });
      expect(res[1]).toMatchObject({ ownerEmail: null, usedBytes: "0" });
    });

    it("skips owner and usage lookups entirely for an empty result set", async () => {
      m.repo.find.mockResolvedValueOnce([]);
      const res = await svc.list({} as never, { callerId: "x", canSeeAll: true });
      expect(res).toEqual([]);
      expect(m.accounts.findBy).not.toHaveBeenCalled();
      expect(m.quotaDomains.find).not.toHaveBeenCalled();
    });
  });

  describe("list (paginated)", () => {
    it("searches, sorts on a whitelisted column ascending, and returns items + total", async () => {
      m.repo.findAndCount.mockResolvedValueOnce([[{ id: 1, domain: "a.com", ownerId: null }], 1]);
      const res = await svc.list(
        { limit: 10, offset: 20, search: "a", sortBy: "domain", sortDir: "asc" } as never,
        { callerId: "x", canSeeAll: true }
      );
      const arg = m.repo.findAndCount.mock.calls[0][0];
      expect(arg.take).toBe(10);
      expect(arg.skip).toBe(20);
      expect(arg.order).toEqual({ domain: "ASC" });
      expect(arg.where.domain).toBeDefined(); // Like(%a%) applied
      expect(res).toMatchObject({ total: 1 });
      expect((res as { items: unknown[] }).items).toHaveLength(1);
    });

    it("falls back to the default sort column (id, desc) on an unknown/absent sortBy and no search", async () => {
      m.repo.findAndCount.mockResolvedValueOnce([[], 0]);
      await svc.list({ limit: 25, offset: 0, sortDir: "desc" } as never, { callerId: "me", canSeeAll: false });
      const arg = m.repo.findAndCount.mock.calls[0][0];
      expect(arg.order).toEqual({ id: "DESC" });
      expect(arg.where).toEqual({ ownerId: "me" }); // no search -> plain owner filter
    });
  });

  describe("get", () => {
    it("throws NotFound when the domain is absent", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      await expect(svc.get(9)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns the domain with owner email attached", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", ownerId: "acc1" });
      m.accounts.findBy.mockResolvedValueOnce([{ id: "acc1", email: "o@d.com" }]);
      const res = await svc.get(5);
      expect(res).toMatchObject({ id: 5, domain: "d.com", ownerEmail: "o@d.com" });
    });
  });

  describe("disk", () => {
    it("computes total/free/reserved/assignable from statfs + summed quotas", async () => {
      statfsMock.mockResolvedValueOnce({ blocks: 1000, bsize: 4096, bavail: 500 } as never);
      m.repo.createQueryBuilder.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValueOnce({ sum: "1000000" }),
      });
      const res = await svc.disk();
      // total=4096000, free=2048000, reserved=1000000
      expect(res).toEqual({
        totalBytes: 4096000,
        freeBytes: 2048000,
        reservedBytes: 1000000,
        assignableBytes: 2048000,
      });
    });

    it("treats a null SUM aggregate as zero reserved bytes", async () => {
      statfsMock.mockResolvedValueOnce({ blocks: 1000, bsize: 4096, bavail: 500 } as never);
      m.repo.createQueryBuilder.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValueOnce(null),
      });
      const res = await svc.disk();
      expect(res.reservedBytes).toBe(0);
      expect(res.assignableBytes).toBe(2048000);
    });
  });

  describe("create", () => {
    it("rejects a duplicate FQDN with 409 and never saves", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 1, domain: "dup.com" });
      await expect(svc.create({ domain: "dup.com", quota: 10485760 } as never, "owner-1")).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(m.repo.save).not.toHaveBeenCalled();
    });

    it("rejects a quota above the assignable headroom with 400", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ assignableBytes: 100 } as never);
      await expect(svc.create({ domain: "new.com", quota: 10485760 } as never, "owner-1")).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(m.repo.save).not.toHaveBeenCalled();
    });

    it("saves the domain, reserves a fresh inactive postmaster, and returns the generated dkim key", async () => {
      m.repo.findOne.mockResolvedValueOnce(null); // no conflict
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ assignableBytes: 99_999_999 } as never);
      m.users.findOne.mockResolvedValueOnce(null); // no existing postmaster
      m.dkim.create.mockResolvedValueOnce({ selector: "s", domain: "new.com" });

      const res = await svc.create({ domain: "new.com", quota: 10485760, active: true } as never, "owner-1");

      expect(m.repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ domain: "new.com", quota: "10485760", active: 1, ownerId: "owner-1" })
      );
      expect(m.users.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: "postmaster@new.com", active: 0, domain: "new.com" })
      );
      expect(res.dkim).toEqual({ selector: "s", domain: "new.com" });
    });

    it("forces an existing active postmaster back inactive and tolerates a dkim failure (null key)", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ assignableBytes: 99_999_999 } as never);
      m.users.findOne.mockResolvedValueOnce({ id: 7, email: "postmaster@new.com", active: 1 });
      m.dkim.create.mockRejectedValueOnce(new Error("dkim boom"));

      const res = await svc.create({ domain: "new.com", quota: 10485760, active: false } as never, "owner-1");

      expect(m.users.save).toHaveBeenCalledWith(expect.objectContaining({ id: 7, active: 0 }));
      expect(res.dkim).toBeNull();
    });

    it("leaves an already-inactive postmaster untouched", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ assignableBytes: 99_999_999 } as never);
      m.users.findOne.mockResolvedValueOnce({ id: 7, email: "postmaster@new.com", active: 0 });
      m.dkim.create.mockResolvedValueOnce({ selector: "s" });

      await svc.create({ domain: "new.com", quota: 10485760 } as never, "owner-1");
      expect(m.users.save).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("rejects a resize above headroom (assignable + current quota) with 400", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", quota: "1000", ownerId: null });
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ assignableBytes: 10_000 } as never);
      await expect(svc.update(5, { quota: 999_999 } as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(m.repo.save).not.toHaveBeenCalled();
    });

    it("applies a resize within headroom and persists the quota as a string", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", quota: "1000", ownerId: null });
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ assignableBytes: 10_000 } as never);
      await svc.update(5, { quota: 5000 } as never);
      expect(m.repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, quota: "5000" }));
    });

    it("updates active + userEndDate without consulting disk when quota is absent", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", quota: "1000", ownerId: null });
      const diskSpy = vi.spyOn(svc, "disk");
      await svc.update(5, { active: true, userEndDate: "2027-01-01" } as never);
      expect(diskSpy).not.toHaveBeenCalled();
      expect(m.repo.save).toHaveBeenCalledWith(expect.objectContaining({ active: 1, userEndDate: "2027-01-01" }));
    });

    it("deactivates the domain (active=false -> 0)", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", quota: "1000", active: 1, ownerId: null });
      await svc.update(5, { active: false } as never);
      expect(m.repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, active: 0 }));
    });
  });

  describe("remove", () => {
    it("removes dkim keys, the row, then the on-disk maildir tree and returns ok", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", ownerId: null });
      const res = await svc.remove(5);
      expect(m.dkim.removeAll).toHaveBeenCalledWith("d.com");
      expect(m.repo.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 5, domain: "d.com" }));
      expect(m.storage.removeDomain).toHaveBeenCalledWith("d.com");
      expect(res).toEqual({ ok: true });
    });

    it("still deletes the row and tree when dkim cleanup rejects", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", ownerId: null });
      m.dkim.removeAll.mockRejectedValueOnce(new Error("dkim cleanup boom"));
      const res = await svc.remove(5);
      expect(m.repo.remove).toHaveBeenCalled();
      expect(m.storage.removeDomain).toHaveBeenCalledWith("d.com");
      expect(res).toEqual({ ok: true });
    });
  });

  describe("transferOwner", () => {
    it("throws NotFound when the domain does not exist", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      await expect(svc.transferOwner(5, { id: "actor", isRoot: true }, "new-owner")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("throws NotFound when the target account does not exist", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", ownerId: "old" });
      m.accounts.findOne.mockResolvedValueOnce(null);
      await expect(svc.transferOwner(5, { id: "actor", isRoot: true }, "ghost")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("reassigns the owner, persists, and writes an audit record", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", ownerId: "old" });
      m.accounts.findOne.mockResolvedValueOnce({ id: "new" });
      const res = await svc.transferOwner(5, { id: "actor", isRoot: false }, "new");
      expect(res.ownerId).toBe("new");
      expect(m.repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, ownerId: "new" }));
      expect(m.auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "actor",
          action: "domain.owner.changed",
          entityType: "domain",
          entityId: 5,
          before: { ownerId: "old" },
          after: { ownerId: "new" },
        })
      );
    });
  });
});
