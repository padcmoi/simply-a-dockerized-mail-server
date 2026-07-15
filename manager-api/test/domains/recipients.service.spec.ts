import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import type { Repository } from "typeorm";
import { RecipientsService } from "../../src/api/domains/recipients/recipients.service";
import { ApiError } from "../../src/core/common/api-error";
import type { CreateRecipientDto } from "../../src/api/domains/recipients/recipients.validation";
import type { PaginationQuery } from "../../src/core/common/pagination.validation";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { VirtualQuotaUser } from "../../src/core/entities/virtual-quota-user.entity";
import { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import type { MailStorageService } from "../../src/core/mail-storage/mail-storage.service";
import { type Loose, providerMock, repoMock } from "../helpers/mocks";

// No openssl process is spawned: the crypt helper is replaced with a
// deterministic, synchronous double so a saved `password` is assertable.
vi.mock("../../src/core/common/sha512-crypt", () => ({
  sha512crypt: vi.fn(async (plain: string) => `hashed:${plain}`),
}));

const FQDN = "example.com";

// A valid PaginationQuery: offset/sortDir always survive parsing; an absent
// limit selects the legacy unpaginated path.
const q = (over: Partial<PaginationQuery> = {}): PaginationQuery => ({ offset: 0, sortDir: "desc", ...over });

// Chainable QueryBuilder double, shared by `list` (paginated) and `headroom`.
// Every builder step returns the same object; terminals carry sane defaults a
// test overrides when it asserts a specific value.
function makeQb() {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["leftJoin", "addSelect", "select", "where", "andWhere", "orderBy", "skip", "take"]) {
    qb[m] = vi.fn(() => qb);
  }
  qb.getCount = vi.fn(async () => 0);
  qb.getRawAndEntities = vi.fn(async () => ({ entities: [], raw: [] }));
  qb.getRawOne = vi.fn(async () => ({ allocated: "0" }));
  return qb;
}

// Resolve a promise expected to reject, returning the thrown error.
async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("expected the promise to reject, but it resolved");
}

describe("RecipientsService", () => {
  let recipients: ReturnType<typeof makeRecipientsRepo>;
  let domains: Loose<Repository<VirtualDomain>>;
  let recipientQuotas: Loose<Repository<VirtualQuotaUser>>;
  let storage: Loose<MailStorageService>;
  let qb: ReturnType<typeof makeQb>;
  let svc: RecipientsService;

  function makeRecipientsRepo() {
    const repo = repoMock<VirtualUser>();
    // Echo the saved row (the DB default), mirroring the original double.
    repo.save.mockImplementation(async (x: object) => x);
    repo.createQueryBuilder.mockReturnValue(qb);
    return repo;
  }

  beforeEach(() => {
    qb = makeQb();
    recipients = makeRecipientsRepo();
    domains = repoMock<VirtualDomain>();
    recipientQuotas = repoMock<VirtualQuotaUser>();
    storage = providerMock<MailStorageService>({ removeRecipient: vi.fn() });
    svc = new RecipientsService(recipients, domains, recipientQuotas, storage);
  });

  describe("resolveDomain", () => {
    it("returns the parent's FQDN", async () => {
      domains.findOne.mockResolvedValue({ id: 1, domain: FQDN });
      await expect(svc.resolveDomain(1)).resolves.toBe(FQDN);
      expect(domains.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it("404s on an unknown parent", async () => {
      domains.findOne.mockResolvedValue(null);
      await expect(svc.resolveDomain(9)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("list (legacy, no limit)", () => {
    it("returns rows ordered by email with usedBytes attached (matched + back-filled '0')", async () => {
      recipients.find.mockResolvedValue([{ email: "a@example.com" }, { email: "b@example.com" }]);
      recipientQuotas.find.mockResolvedValue([{ email: "a@example.com", bytes: "123" }]);

      const res = await svc.list(FQDN, q());

      expect(recipients.find).toHaveBeenCalledWith({ where: { domain: FQDN }, order: { email: "ASC" } });
      expect(res).toEqual([
        { email: "a@example.com", usedBytes: "123" },
        { email: "b@example.com", usedBytes: "0" },
      ]);
    });

    it("skips the quota lookup entirely for an empty domain", async () => {
      recipients.find.mockResolvedValue([]);
      const res = await svc.list(FQDN, q());
      expect(res).toEqual([]);
      expect(recipientQuotas.find).not.toHaveBeenCalled();
    });
  });

  describe("list (paginated)", () => {
    it("searches, sorts on the joined usedBytes column, and maps raw usedBytes (missing -> '0')", async () => {
      qb.getCount.mockResolvedValueOnce(2);
      qb.getRawAndEntities.mockResolvedValueOnce({
        entities: [{ id: 1, email: "a@example.com" }, { id: 2, email: "b@example.com" }],
        raw: [{ usedBytes: "999" }, {}],
      });

      const res = await svc.list(FQDN, q({ limit: 10, search: "jd", sortBy: "usedBytes", sortDir: "asc" }));

      expect(qb.where).toHaveBeenCalledWith("r.domain = :domain", { domain: FQDN });
      expect(qb.andWhere).toHaveBeenCalledWith("r.email LIKE :search", { search: "%jd%" });
      expect(qb.orderBy).toHaveBeenCalledWith("usedBytes", "ASC");
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(res).toEqual({
        items: [
          { id: 1, email: "a@example.com", usedBytes: "999" },
          { id: 2, email: "b@example.com", usedBytes: "0" },
        ],
        total: 2,
      });
    });

    it("without a search term, falls back to the id column on an unknown sortBy and orders on r.<col>", async () => {
      qb.getCount.mockResolvedValueOnce(0);
      qb.getRawAndEntities.mockResolvedValueOnce({ entities: [], raw: [] });

      await svc.list(FQDN, q({ limit: 25, offset: 25, sortBy: "bogus" }));

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith("r.id", "DESC");
      expect(qb.skip).toHaveBeenCalledWith(25);
      expect(qb.take).toHaveBeenCalledWith(25);
    });
  });

  describe("get", () => {
    it("returns a recipient scoped to its domain", async () => {
      recipients.findOne.mockResolvedValue({ id: 5, email: "jdoe@example.com" });
      await expect(svc.get(5, FQDN)).resolves.toMatchObject({ id: 5 });
      expect(recipients.findOne).toHaveBeenCalledWith({ where: { id: 5, domain: FQDN } });
    });

    it("404s (ApiError recipients.notFound) when absent from the domain", async () => {
      recipients.findOne.mockResolvedValue(null);
      const e = await rejection(svc.get(5, FQDN));
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).getStatus()).toBe(404);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "recipients.notFound" });
    });
  });

  describe("headroom", () => {
    it("404s on an unknown domain", async () => {
      domains.findOne.mockResolvedValue(null);
      await expect(svc.headroom(FQDN)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("sums allocations for the whole domain when no recipient is excluded", async () => {
      domains.findOne.mockResolvedValue({ quota: "1000" });
      qb.getRawOne.mockResolvedValueOnce({ allocated: "200" });

      const res = await svc.headroom(FQDN);

      expect(res).toEqual({ domainQuota: 1000, allocated: 200, available: 800 });
      expect(qb.select).toHaveBeenCalledWith("COALESCE(SUM(r.quota), 0)", "allocated");
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it("excludes the recipient being resized and treats a null aggregate as 0", async () => {
      domains.findOne.mockResolvedValue({ quota: "1000" });
      qb.getRawOne.mockResolvedValueOnce(null);

      const res = await svc.headroom(FQDN, 7);

      expect(qb.andWhere).toHaveBeenCalledWith("r.id != :id", { id: 7 });
      expect(res).toEqual({ domainQuota: 1000, allocated: 0, available: 1000 });
    });
  });

  describe("create", () => {
    const dto = (over: Partial<CreateRecipientDto> = {}): CreateRecipientDto =>
      ({ localPart: "jdoe", password: "correcthorse", quota: 104857600, ...over });

    it("409s when the local-part is postmaster (case-insensitive, reserved)", async () => {
      const e = await rejection(svc.create(dto({ localPart: "Postmaster" }), FQDN));
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).getStatus()).toBe(409);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "recipients.postmasterReserved" });
      expect(recipients.save).not.toHaveBeenCalled();
    });

    it("409s on a duplicate address", async () => {
      recipients.findOne.mockResolvedValue({ id: 9 });
      const e = await rejection(svc.create(dto(), FQDN));
      expect((e as ApiError).getStatus()).toBe(409);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "recipients.alreadyExists" });
      expect(recipients.save).not.toHaveBeenCalled();
    });

    it("400s (quotaExceedsDomain) when the quota does not fit the domain's headroom", async () => {
      recipients.findOne.mockResolvedValue(null);
      domains.findOne.mockResolvedValue({ quota: "1000000" }); // ~1 MB, less than the requested 100 MB
      const e = await rejection(svc.create(dto(), FQDN));
      expect((e as ApiError).getStatus()).toBe(400);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "recipients.quotaExceedsDomain" });
      expect(recipients.save).not.toHaveBeenCalled();
    });

    it("saves a new recipient (active default 1, null end-date, derived email/maildir, hashed password)", async () => {
      recipients.findOne.mockResolvedValue(null);
      domains.findOne.mockResolvedValue({ quota: "1000000000" });

      await svc.create(dto(), FQDN);

      const saved = recipients.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved).toMatchObject({
        email: "jdoe@example.com",
        domain: FQDN,
        password: "hashed:correcthorse",
        maildir: "example.com/jdoe/",
        quota: "104857600",
        active: 1,
        uid: "vmail",
        gid: "vmail",
        userEndDate: null,
      });
      expect(saved.userStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("honours active:false (-> 0) and a provided end-date", async () => {
      recipients.findOne.mockResolvedValue(null);
      domains.findOne.mockResolvedValue({ quota: "1000000000" });

      await svc.create(dto({ active: false, userEndDate: "2027-01-01" }), FQDN);

      expect(recipients.save.mock.calls[0][0]).toMatchObject({ active: 0, userEndDate: "2027-01-01" });
    });
  });

  describe("update", () => {
    const current = (over: Record<string, unknown> = {}) => ({
      id: 5,
      email: "jdoe@example.com",
      domain: FQDN,
      password: "old",
      quota: "1048576",
      active: 1,
      userEndDate: null,
      ...over,
    });

    it("403s (postmasterImmutable) for postmaster@<domain>", async () => {
      recipients.findOne.mockResolvedValue(current({ email: `postmaster@${FQDN}` }));
      const e = await rejection(svc.update(5, {}, FQDN));
      expect((e as ApiError).getStatus()).toBe(403);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "recipients.postmasterImmutable" });
      expect(recipients.save).not.toHaveBeenCalled();
    });

    it("400s (quotaBelowUsage) when the new quota is under what the mailbox already stores", async () => {
      recipients.findOne.mockResolvedValue(current({ quota: "104857600" }));
      recipientQuotas.findOne.mockResolvedValue({ bytes: "5000000" }); // ~5 MB used
      const e = await rejection(svc.update(5, { quota: 1048576 }, FQDN));
      expect((e as ApiError).getStatus()).toBe(400);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "recipients.quotaBelowUsage" });
      expect(recipients.save).not.toHaveBeenCalled();
    });

    it("400s (quotaExceedsDomain) when a raised quota does not fit the domain", async () => {
      recipients.findOne.mockResolvedValue(current({ quota: "1048576" }));
      recipientQuotas.findOne.mockResolvedValue({ bytes: "0" });
      domains.findOne.mockResolvedValue({ quota: "2000000" }); // ~2 MB headroom, request is 100 MB
      const e = await rejection(svc.update(5, { quota: 104857600 }, FQDN));
      expect((e as ApiError).getStatus()).toBe(400);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "recipients.quotaExceedsDomain" });
    });

    it("shrinking a quota bypasses the domain-fit check (headroom never consulted); a mailbox with no quota row yet reads as 0 used", async () => {
      recipients.findOne.mockResolvedValue(current({ quota: "104857600" }));
      recipientQuotas.findOne.mockResolvedValue(null); // dovecot never delivered here -> used treated as 0

      await svc.update(5, { quota: 52428800, active: true }, FQDN);

      // The resize bypass means assertQuotaFitsDomain returns before headroom,
      // so no parent lookup and no aggregate query ran.
      expect(domains.findOne).not.toHaveBeenCalled();
      expect(recipients.createQueryBuilder).not.toHaveBeenCalled();
      expect(recipients.save.mock.calls[0][0]).toMatchObject({ quota: "52428800", active: 1 });
    });

    it("applies password, a raised (fitting) quota, active:false and end-date, then saves", async () => {
      recipients.findOne.mockResolvedValue(current({ quota: "1048576", active: 1 }));
      recipientQuotas.findOne.mockResolvedValue({ bytes: "1000" });
      domains.findOne.mockResolvedValue({ quota: "1000000000" });

      await svc.update(
        5,
        { password: "newpass", quota: 104857600, active: false, userEndDate: "2027-06-01" },
        FQDN
      );

      expect(recipients.save.mock.calls[0][0]).toMatchObject({
        password: "hashed:newpass",
        quota: "104857600",
        active: 0,
        userEndDate: "2027-06-01",
      });
    });

    it("with no quota in the body, never touches the usage/domain checks", async () => {
      recipients.findOne.mockResolvedValue(current({ active: 1 }));

      await svc.update(5, { active: false }, FQDN);

      expect(recipientQuotas.findOne).not.toHaveBeenCalled();
      expect(domains.findOne).not.toHaveBeenCalled();
      expect(recipients.save.mock.calls[0][0]).toMatchObject({ active: 0 });
    });
  });

  describe("remove", () => {
    it("403s (postmasterUndeletable) for postmaster@<domain>", async () => {
      recipients.findOne.mockResolvedValue({ id: 1, email: `postmaster@${FQDN}`, maildir: `${FQDN}/postmaster/` });
      const e = await rejection(svc.remove(1, FQDN));
      expect((e as ApiError).getStatus()).toBe(403);
      expect((e as ApiError).getResponse()).toMatchObject({ code: "recipients.postmasterUndeletable" });
      expect(recipientQuotas.delete).not.toHaveBeenCalled();
      expect(storage.removeRecipient).not.toHaveBeenCalled();
    });

    it("deletes the quota row first, then the user row, then the mail on disk", async () => {
      const row = { id: 5, email: "jdoe@example.com", maildir: "example.com/jdoe/", quota: "104857600" };
      recipients.findOne.mockResolvedValue(row);

      const res = await svc.remove(5, FQDN);

      expect(recipientQuotas.delete).toHaveBeenCalledWith({ email: "jdoe@example.com" });
      expect(recipients.remove).toHaveBeenCalledWith(row);
      expect(storage.removeRecipient).toHaveBeenCalledWith("example.com/jdoe/", "jdoe@example.com");
      expect(res).toEqual({ ok: true });

      const quotaDelete = recipientQuotas.delete.mock.invocationCallOrder[0];
      const rowRemove = recipients.remove.mock.invocationCallOrder[0];
      const diskRemove = storage.removeRecipient.mock.invocationCallOrder[0];
      expect(quotaDelete).toBeLessThan(rowRemove);
      expect(rowRemove).toBeLessThan(diskRemove);
    });
  });
});
