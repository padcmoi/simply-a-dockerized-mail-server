import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { DomainsService } from "../../src/api/domains/domains.service";
import type { PaginationQuery } from "../../src/core/common/pagination.validation";
import { Account } from "../../src/core/entities/account.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { VirtualQuotaDomain } from "../../src/core/entities/virtual-quota-domain.entity";
import { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import type { AuditLogService } from "../../src/core/audit/audit-log.service";
import type { DkimService } from "../../src/core/dkim/dkim.service";
import type { MailStorageService } from "../../src/core/mail-storage/mail-storage.service";
import { providerMock, qbMock, repoMock } from "../helpers/mocks";

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

// A complete StatsFs row; disk() only reads blocks/bsize/bavail.
const STATFS = { type: 0, bsize: 4096, blocks: 1000, bfree: 0, bavail: 500, files: 0, ffree: 0 };

// One typed double per constructor arg, in order:
// repo, users, accounts, quotaDomains, dkim, auditLog, storage. The repositories
// and providers slot straight into the constructor with no cast, so a wrong
// repo type or an invalid DTO now fails `tsc`.
function makeMocks() {
  const repo = repoMock<VirtualDomain>();
  repo.save.mockImplementation(async (x: object) => x);
  const txSave = vi.fn(async (_target: unknown, entity: object) => entity);
  const txFindOne = vi.fn();
  Object.assign(repo, {
    manager: {
      transaction: vi.fn(async (cb: (m: { save: typeof txSave; findOne: typeof txFindOne }) => unknown) =>
        cb({ save: txSave, findOne: txFindOne })
      ),
    },
  });
  const accounts = repoMock<Account>();
  accounts.findBy.mockResolvedValue([]);
  const quotaDomains = repoMock<VirtualQuotaDomain>();
  quotaDomains.find.mockResolvedValue([]);
  return {
    repo,
    txSave,
    txFindOne,
    users: repoMock<VirtualUser>(),
    accounts,
    quotaDomains,
    dkim: providerMock<DkimService>({ create: vi.fn(), removeAll: vi.fn().mockResolvedValue(undefined) }),
    auditLog: providerMock<AuditLogService>({ record: vi.fn().mockResolvedValue(undefined) }),
    storage: providerMock<MailStorageService>({ removeDomain: vi.fn().mockResolvedValue(undefined) }),
  };
}

// A valid PaginationQuery: `offset`/`sortDir` always survive parsing; an absent
// `limit` selects the legacy unpaginated path.
const q = (over: Partial<PaginationQuery> = {}): PaginationQuery => ({ offset: 0, sortDir: "desc", ...over });

describe("DomainsService", () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: DomainsService;

  beforeEach(() => {
    m = makeMocks();
    svc = new DomainsService(m.repo, m.users, m.accounts, m.quotaDomains, m.dkim, m.auditLog, m.storage);
  });

  describe("list (legacy, unpaginated)", () => {
    it("scopes to every row when canSeeAll and enriches owner email + used bytes", async () => {
      m.repo.find.mockResolvedValueOnce([{ id: 1, domain: "a.com", ownerId: "acc1" }]);
      m.accounts.findBy.mockResolvedValueOnce([{ id: "acc1", email: "owner@a.com" }]);
      m.quotaDomains.find.mockResolvedValueOnce([{ domain: "a.com", bytes: "512" }]);

      const res = await svc.list(q(), { callerId: "acc1", canSeeAll: true });

      expect(m.repo.find).toHaveBeenCalledWith({ where: {}, order: { domain: "ASC" } });
      expect(res).toEqual([
        { id: 1, domain: "a.com", ownerId: "acc1", ownerEmail: "owner@a.com", usedBytes: "512" },
      ]);
    });

    it("scopes to owned rows only when not canSeeAll", async () => {
      m.repo.find.mockResolvedValueOnce([]);
      await svc.list(q(), { callerId: "me", canSeeAll: false });
      expect(m.repo.find).toHaveBeenCalledWith({ where: { ownerId: "me" }, order: { domain: "ASC" } });
    });

    it("falls back to null owner email (owner missing or null) and 0 bytes when no quota row", async () => {
      m.repo.find.mockResolvedValueOnce([
        { id: 1, domain: "a.com", ownerId: "gone" }, // account row not returned
        { id: 2, domain: "b.com", ownerId: null }, // no owner at all
      ]);
      m.accounts.findBy.mockResolvedValueOnce([]);
      m.quotaDomains.find.mockResolvedValueOnce([]);

      const res = await svc.list(q(), { callerId: "x", canSeeAll: true });
      if (!Array.isArray(res)) throw new Error("expected the unpaginated list");

      expect(m.accounts.findBy).toHaveBeenCalledTimes(1); // one non-null ownerId -> lookup happened
      expect(res[0]).toMatchObject({ ownerEmail: null, usedBytes: "0" });
      expect(res[1]).toMatchObject({ ownerEmail: null, usedBytes: "0" });
    });

    it("skips owner and usage lookups entirely for an empty result set", async () => {
      m.repo.find.mockResolvedValueOnce([]);
      const res = await svc.list(q(), { callerId: "x", canSeeAll: true });
      expect(res).toEqual([]);
      expect(m.accounts.findBy).not.toHaveBeenCalled();
      expect(m.quotaDomains.find).not.toHaveBeenCalled();
    });
  });

  describe("list (paginated)", () => {
    it("searches, sorts on a whitelisted column ascending, and returns items + total", async () => {
      m.repo.findAndCount.mockResolvedValueOnce([[{ id: 1, domain: "a.com", ownerId: null }], 1]);
      const res = await svc.list(
        { limit: 10, offset: 20, search: "a", sortBy: "domain", sortDir: "asc" },
        { callerId: "x", canSeeAll: true }
      );
      const arg = m.repo.findAndCount.mock.calls[0][0];
      expect(arg.take).toBe(10);
      expect(arg.skip).toBe(20);
      expect(arg.order).toEqual({ domain: "ASC" });
      expect(arg.where.domain).toBeDefined(); // Like(%a%) applied
      if (Array.isArray(res)) throw new Error("expected a paginated result");
      expect(res).toMatchObject({ total: 1 });
      expect(res.items).toHaveLength(1);
    });

    it("falls back to the default sort column (id, desc) on an unknown/absent sortBy and no search", async () => {
      m.repo.findAndCount.mockResolvedValueOnce([[], 0]);
      await svc.list({ limit: 25, offset: 0, sortDir: "desc" }, { callerId: "me", canSeeAll: false });
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
      statfsMock.mockResolvedValueOnce(STATFS);
      const qb = qbMock<VirtualDomain>();
      qb.getRawOne.mockResolvedValueOnce({ sum: "1000000" });
      m.repo.createQueryBuilder.mockReturnValueOnce(qb);
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
      statfsMock.mockResolvedValueOnce(STATFS);
      const qb = qbMock<VirtualDomain>();
      qb.getRawOne.mockResolvedValueOnce(null);
      m.repo.createQueryBuilder.mockReturnValueOnce(qb);
      const res = await svc.disk();
      expect(res.reservedBytes).toBe(0);
      expect(res.assignableBytes).toBe(2048000);
    });
  });

  describe("create", () => {
    it("rejects a duplicate FQDN with 409 and never saves", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 1, domain: "dup.com" });
      await expect(svc.create({ domain: "dup.com", quota: 10485760 }, "owner-1")).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(m.txSave).not.toHaveBeenCalled();
    });

    it("rejects a quota above the assignable headroom with 400", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ totalBytes: 0, freeBytes: 0, reservedBytes: 0, assignableBytes: 100 });
      await expect(svc.create({ domain: "new.com", quota: 10485760 }, "owner-1")).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(m.txSave).not.toHaveBeenCalled();
    });

    it("saves the domain and its postmaster in one transaction and returns the generated dkim key", async () => {
      m.repo.findOne.mockResolvedValueOnce(null); // no conflict
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ totalBytes: 0, freeBytes: 0, reservedBytes: 0, assignableBytes: 99_999_999 });
      m.txFindOne.mockResolvedValueOnce(null); // no existing postmaster
      m.dkim.create.mockResolvedValueOnce({ selector: "s", domain: "new.com" });

      const res = await svc.create({ domain: "new.com", quota: 10485760, active: true }, "owner-1");

      expect(m.txSave).toHaveBeenCalledWith(
        VirtualDomain,
        expect.objectContaining({ domain: "new.com", quota: "10485760", active: 1, ownerId: "owner-1" })
      );
      expect(m.txSave).toHaveBeenCalledWith(
        VirtualUser,
        expect.objectContaining({ email: "postmaster@new.com", active: 0, domain: "new.com", maildir: "new.com/postmaster/" })
      );
      expect(res.dkim).toEqual({ selector: "s", domain: "new.com" });
    });

    it("forces an existing active postmaster back inactive and tolerates a dkim failure (null key)", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ totalBytes: 0, freeBytes: 0, reservedBytes: 0, assignableBytes: 99_999_999 });
      m.txFindOne.mockResolvedValueOnce({ id: 7, email: "postmaster@new.com", active: 1 });
      m.dkim.create.mockRejectedValueOnce(new Error("dkim boom"));

      const res = await svc.create({ domain: "new.com", quota: 10485760, active: false }, "owner-1");

      expect(m.txSave).toHaveBeenCalledWith(VirtualUser, expect.objectContaining({ id: 7, active: 0 }));
      expect(res.dkim).toBeNull();
    });

    it("leaves an already-inactive postmaster untouched", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ totalBytes: 0, freeBytes: 0, reservedBytes: 0, assignableBytes: 99_999_999 });
      m.txFindOne.mockResolvedValueOnce({ id: 7, email: "postmaster@new.com", active: 0 });
      m.dkim.create.mockResolvedValueOnce({ selector: "s" });

      await svc.create({ domain: "new.com", quota: 10485760 }, "owner-1");
      expect(m.txSave).not.toHaveBeenCalledWith(VirtualUser, expect.anything());
    });

    it("rolls the whole create back when reserving the postmaster fails", async () => {
      m.repo.findOne.mockResolvedValueOnce(null);
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ totalBytes: 0, freeBytes: 0, reservedBytes: 0, assignableBytes: 99_999_999 });
      m.txFindOne.mockResolvedValueOnce(null);
      m.txSave.mockResolvedValueOnce({ domain: "new.com" }); // domain row
      m.txSave.mockRejectedValueOnce(new Error("Data too long for column 'maildir'")); // postmaster insert fails
      await expect(svc.create({ domain: "new.com", quota: 10485760 }, "owner-1")).rejects.toThrow(/maildir/);
      expect(m.dkim.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("rejects a resize above headroom (assignable + current quota) with 400", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", quota: "1000", ownerId: null });
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ totalBytes: 0, freeBytes: 0, reservedBytes: 0, assignableBytes: 10_000 });
      await expect(svc.update(5, { quota: 999_999 })).rejects.toBeInstanceOf(BadRequestException);
      expect(m.repo.save).not.toHaveBeenCalled();
    });

    it("applies a resize within headroom and persists the quota as a string", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", quota: "1000", ownerId: null });
      vi.spyOn(svc, "disk").mockResolvedValueOnce({ totalBytes: 0, freeBytes: 0, reservedBytes: 0, assignableBytes: 10_000 });
      await svc.update(5, { quota: 5000 });
      expect(m.repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, quota: "5000" }));
    });

    it("updates active + userEndDate without consulting disk when quota is absent", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", quota: "1000", ownerId: null });
      const diskSpy = vi.spyOn(svc, "disk");
      await svc.update(5, { active: true, userEndDate: "2027-01-01" });
      expect(diskSpy).not.toHaveBeenCalled();
      expect(m.repo.save).toHaveBeenCalledWith(expect.objectContaining({ active: 1, userEndDate: "2027-01-01" }));
    });

    it("deactivates the domain (active=false -> 0)", async () => {
      m.repo.findOne.mockResolvedValueOnce({ id: 5, domain: "d.com", quota: "1000", active: 1, ownerId: null });
      await svc.update(5, { active: false });
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
