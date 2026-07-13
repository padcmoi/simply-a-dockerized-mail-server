import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { QuotasController } from "../../src/api/domains/quotas/quotas.controller";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { VirtualQuotaDomain } from "../../src/core/entities/virtual-quota-domain.entity";
import { VirtualQuotaUser } from "../../src/core/entities/virtual-quota-user.entity";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const DOMAIN_ID = 12;
const FQDN = "example.com";
const DOMAIN_QUOTA = "157286400";
const base = `/api/v1/domains/${DOMAIN_ID}/quotas`;

// Chainable QueryBuilder double: every builder step returns the same object, so
// the controller's fluent chain works, and each terminal is a vi.fn we assert
// on / feed a result to.
function makeQb() {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["leftJoin", "addSelect", "select", "where", "andWhere", "orderBy", "skip", "take"]) {
    qb[m] = vi.fn(() => qb);
  }
  qb.getCount = vi.fn(async () => 0);
  qb.getRawAndEntities = vi.fn(async () => ({ entities: [], raw: [] }));
  return qb;
}

describe("QuotasController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  // Serves both the DomainPermissionGuard's ownership lookup and the controller's
  // own resolveDomain; a valid row by default (impl survives clearMocks), the
  // 404 case overrides it once.
  const domainRepo = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) => ({
      id: where.id,
      domain: FQDN,
      ownerId: null as string | null,
      quota: DOMAIN_QUOTA,
    })),
  };
  const domainQuotasRepo = { findOne: vi.fn(async () => null as unknown) };
  const recipientQuotasRepo = { createQueryBuilder: vi.fn(() => makeQb()) };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [QuotasController],
      providers: [
        // Registered after the harness defaults, so these win the token.
        { provide: getRepositoryToken(VirtualDomain), useValue: domainRepo },
        { provide: getRepositoryToken(VirtualQuotaDomain), useValue: domainQuotasRepo },
        { provide: getRepositoryToken(VirtualQuotaUser), useValue: recipientQuotasRepo },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const grant = () => {
    h.cpg.grantGlobal("domains", "access");
    h.cpg.grantDomain(DOMAIN_ID, "domain", "access");
    h.cpg.grantDomain(DOMAIN_ID, "quotas", "access", "view-quotas");
  };

  describe("auth (401)", () => {
    it("401 without a token", async () => {
      await api().get(base).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(base).set("Authorization", "Bearer nope").expect(401);
    });
  });

  describe("ACL", () => {
    it("403 for a user without any grant", async () => {
      await api().get(base).set("Authorization", user()).expect(403);
    });
    it("200 for a non-root user granted the full chain (domains + domain + quotas:view-quotas)", async () => {
      grant();
      await api().get(base).set("Authorization", user()).expect(200);
    });
    it("200 for root regardless of grants (bypass)", async () => {
      await api().get(base).set("Authorization", root()).expect(200);
    });
  });

  describe("GET / (snapshot) behavior", () => {
    it("legacy (no limit): aggregate + bare recipient array sorted by email, quota back-filled to '0'", async () => {
      domainQuotasRepo.findOne.mockResolvedValueOnce({ id: 1, domain: FQDN, bytes: "104857600", messages: "42" });
      const qb = makeQb();
      qb.getRawAndEntities.mockResolvedValueOnce({
        entities: [
          { id: 5, email: "a@example.com" },
          { id: 6, email: "b@example.com" },
        ],
        raw: [{ quota: "104857600" }, {}],
      });
      recipientQuotasRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const res = await api().get(base).set("Authorization", root()).expect(200);

      expect(res.body.domain).toMatchObject({ quota: DOMAIN_QUOTA, bytes: "104857600", messages: "42" });
      expect(res.body.recipients).toEqual([
        { id: 5, email: "a@example.com", quota: "104857600" },
        { id: 6, email: "b@example.com", quota: "0" },
      ]);
      expect(domainRepo.findOne).toHaveBeenCalledWith({ where: { id: DOMAIN_ID } });
      expect(domainQuotasRepo.findOne).toHaveBeenCalledWith({ where: { domain: FQDN } });
      expect(qb.where).toHaveBeenCalledWith("q.domain = :domain", { domain: FQDN });
      expect(qb.orderBy).toHaveBeenCalledWith("q.email", "ASC");
    });

    it("paginated + search + sortBy=quota asc: null aggregate, { items, total }, quota branch", async () => {
      domainQuotasRepo.findOne.mockResolvedValueOnce(null);
      const qb = makeQb();
      qb.getCount.mockResolvedValueOnce(3);
      qb.getRawAndEntities.mockResolvedValueOnce({ entities: [{ id: 5, email: "jd@example.com" }], raw: [{ quota: "5" }] });
      recipientQuotasRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const res = await api().get(`${base}?limit=10&search=jd&sortBy=quota&sortDir=asc`).set("Authorization", root()).expect(200);

      expect(res.body.domain).toBeNull();
      expect(res.body.recipients).toEqual({ items: [{ id: 5, email: "jd@example.com", quota: "5" }], total: 3 });
      expect(qb.andWhere).toHaveBeenCalledWith("q.email LIKE :search", { search: "%jd%" });
      expect(qb.orderBy).toHaveBeenCalledWith("quota", "ASC");
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it("paginated, no search, unknown sortBy falls back to id (else branch), default desc", async () => {
      domainQuotasRepo.findOne.mockResolvedValueOnce({ id: 1, domain: FQDN, bytes: "1", messages: "1" });
      const qb = makeQb();
      qb.getCount.mockResolvedValueOnce(0);
      qb.getRawAndEntities.mockResolvedValueOnce({ entities: [], raw: [] });
      recipientQuotasRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const res = await api().get(`${base}?limit=25&offset=25&sortBy=bogus`).set("Authorization", root()).expect(200);

      expect(res.body.recipients).toEqual({ items: [], total: 0 });
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith("q.id", "DESC");
      expect(qb.skip).toHaveBeenCalledWith(25);
      expect(qb.take).toHaveBeenCalledWith(25);
    });
  });

  describe("validation + not-found", () => {
    it("400 on an invalid pagination query (limit not 10/25/50)", async () => {
      await api().get(`${base}?limit=7`).set("Authorization", root()).expect(400);
    });

    it("400 when :domainId is not an integer (ParseIntPipe, root bypasses the guard)", async () => {
      await api().get("/api/v1/domains/abc/quotas").set("Authorization", root()).expect(400);
    });

    it("404 when the parent domain does not exist", async () => {
      domainRepo.findOne.mockResolvedValueOnce(null);
      await api().get(base).set("Authorization", root()).expect(404);
    });
  });
});
