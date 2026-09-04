import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { DomainsController } from "../../src/api/domains/domains.controller";
import { DomainsService } from "../../src/api/domains/domains.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// DomainsController.list widens scope with an extra cpg call
// (`this.cpg.guard.getEffectivePermissions`) that the shared harness mock does
// not define. Extend the injected guard here rather than editing the helper: the
// intersection keeps the guard's own methods typed while adding the extra mock.
type EffectiveMock = { getEffectivePermissions: ReturnType<typeof vi.fn> };
const effective = (h: Harness) => h.cpg.guard as typeof h.cpg.guard & EffectiveMock;

const ID = 5;
const UUID = "11111111-1111-1111-1111-111111111111";

describe("DomainsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    list: vi.fn(),
    disk: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    transferOwner: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [DomainsController],
      providers: [{ provide: DomainsService, useValue: svc }],
    });
    // Default: a non-root sees only owned rows (no list-all-domains grant).
    effective(h).getEffectivePermissions = vi.fn().mockResolvedValue({ global: [] });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    effective(h).getEffectivePermissions = vi.fn().mockResolvedValue({ global: [] });
  });

  const api = () => request(h.app.getHttpServer());
  const asRoot = () => ["Authorization", `Bearer ${h.token(ROOT)}`] as [string, string];
  const asUser = () => ["Authorization", `Bearer ${h.token(USER)}`] as [string, string];

  describe("auth (401)", () => {
    const routes: Array<[string, () => request.Test]> = [
      ["GET /domains", () => api().get("/api/v1/domains")],
      ["GET /domains/disk", () => api().get("/api/v1/domains/disk")],
      ["GET /domains/:id", () => api().get(`/api/v1/domains/${ID}`)],
      ["POST /domains", () => api().post("/api/v1/domains")],
      ["PATCH /domains/:id/active", () => api().patch(`/api/v1/domains/${ID}/active`)],
      ["PATCH /domains/:id/owner", () => api().patch(`/api/v1/domains/${ID}/owner`)],
    ];
    for (const [name, build] of routes) {
      it(`401 without a token: ${name}`, async () => {
        await build().expect(401);
      });
      it(`401 with a garbage bearer token: ${name}`, async () => {
        await build().set("Authorization", "Bearer nope").expect(401);
      });
    }
  });

  describe("GET /domains (list)", () => {
    it("403 for a user without domains:access", async () => {
      await api()
        .get("/api/v1/domains")
        .set(...asUser())
        .expect(403);
    });

    it("200 for root and forwards query + canSeeAll=true (root bypass)", async () => {
      svc.list.mockResolvedValueOnce([]);
      await api()
        .get("/api/v1/domains")
        .set(...asRoot())
        .expect(200);
      expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, sortDir: "desc" }), {
        callerId: ROOT.id,
        canSeeAll: true,
      });
    });

    it("200 for a granted user, scoped to owned rows when no list-all-domains", async () => {
      h.cpg.grantGlobal("domains", "access");
      svc.list.mockResolvedValueOnce([]);
      await api()
        .get("/api/v1/domains")
        .set(...asUser())
        .expect(200);
      expect(svc.list).toHaveBeenCalledWith(expect.anything(), { callerId: USER.id, canSeeAll: false });
    });

    it("200 for a granted user with global list-all-domains -> canSeeAll=true", async () => {
      h.cpg.grantGlobal("domains", "access");
      effective(h).getEffectivePermissions.mockResolvedValueOnce({
        global: [{ resource: "domains", action: "list-all-domains" }],
      });
      svc.list.mockResolvedValueOnce([]);
      await api()
        .get("/api/v1/domains")
        .set(...asUser())
        .expect(200);
      expect(svc.list).toHaveBeenCalledWith(expect.anything(), { callerId: USER.id, canSeeAll: true });
    });

    it("400 on an invalid pagination query (limit not in 10/25/50)", async () => {
      await api()
        .get("/api/v1/domains?limit=7")
        .set(...asRoot())
        .expect(400);
    });
  });

  describe("GET /domains/disk", () => {
    it("403 for a user without domains:view-disk-usage", async () => {
      await api()
        .get("/api/v1/domains/disk")
        .set(...asUser())
        .expect(403);
    });

    it("200 for root and calls the service", async () => {
      svc.disk.mockResolvedValueOnce({ totalBytes: 1, freeBytes: 1, reservedBytes: 0, assignableBytes: 1 });
      await api()
        .get("/api/v1/domains/disk")
        .set(...asRoot())
        .expect(200);
      expect(svc.disk).toHaveBeenCalledTimes(1);
    });

    it("200 for a user granted access + view-disk-usage", async () => {
      h.cpg.grantGlobal("domains", "access", "view-disk-usage");
      svc.disk.mockResolvedValueOnce({ totalBytes: 1, freeBytes: 1, reservedBytes: 0, assignableBytes: 1 });
      await api()
        .get("/api/v1/domains/disk")
        .set(...asUser())
        .expect(200);
    });
  });

  describe("GET /domains/:domainId (get)", () => {
    it("403 for a user with no grant and no ownership", async () => {
      await api()
        .get(`/api/v1/domains/${ID}`)
        .set(...asUser())
        .expect(403);
    });

    it("200 for root and forwards the parsed id", async () => {
      svc.get.mockResolvedValueOnce({ id: ID });
      await api()
        .get(`/api/v1/domains/${ID}`)
        .set(...asRoot())
        .expect(200);
      expect(svc.get).toHaveBeenCalledWith(ID);
    });

    it("200 for a non-root via the full domain grant chain", async () => {
      h.cpg.grantGlobal("domains", "access");
      h.cpg.grantDomain(ID, "domain", "access", "view-domain");
      svc.get.mockResolvedValueOnce({ id: ID });
      await api()
        .get(`/api/v1/domains/${ID}`)
        .set(...asUser())
        .expect(200);
      expect(svc.get).toHaveBeenCalledWith(ID);
    });

    it("200 for a non-root owner via the ownership bypass (no grants)", async () => {
      h.setDomainOwner(ID, USER.id);
      svc.get.mockResolvedValueOnce({ id: ID });
      await api()
        .get(`/api/v1/domains/${ID}`)
        .set(...asUser())
        .expect(200);
      h.setDomainOwner(ID, null);
    });

    it("400 when :domainId is not an integer", async () => {
      await api()
        .get("/api/v1/domains/abc")
        .set(...asRoot())
        .expect(400);
    });
  });

  describe("POST /domains (create)", () => {
    it("403 for a user without domains:create-domain", async () => {
      await api()
        .post("/api/v1/domains")
        .set(...asUser())
        .send({ domain: "new.test", quota: 10485760 })
        .expect(403);
    });

    it("201 for root and forwards the parsed body + caller id as owner", async () => {
      svc.create.mockResolvedValueOnce({ id: 1, domain: "new.test", dkim: null });
      await api()
        .post("/api/v1/domains")
        .set(...asRoot())
        .send({ domain: "new.test", quota: 10485760 })
        .expect(201);
      expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ domain: "new.test", quota: 10485760 }), ROOT.id);
    });

    it("201 for a user granted access + create-domain", async () => {
      h.cpg.grantGlobal("domains", "access", "create-domain");
      svc.create.mockResolvedValueOnce({ id: 1 });
      await api()
        .post("/api/v1/domains")
        .set(...asUser())
        .send({ domain: "new.test", quota: 10485760 })
        .expect(201);
    });

    it("400 on an invalid body (missing quota / not a FQDN)", async () => {
      await api()
        .post("/api/v1/domains")
        .set(...asRoot())
        .send({})
        .expect(400);
    });
  });

  describe("PATCH /domains/:domainId/active (setActive)", () => {
    it("403 for a user with no grant and no ownership", async () => {
      await api()
        .patch(`/api/v1/domains/${ID}/active`)
        .set(...asUser())
        .send({ active: false })
        .expect(403);
    });

    it("200 for root and forwards id + { active }", async () => {
      svc.update.mockResolvedValueOnce({ id: ID, active: 0 });
      await api()
        .patch(`/api/v1/domains/${ID}/active`)
        .set(...asRoot())
        .send({ active: false })
        .expect(200);
      expect(svc.update).toHaveBeenCalledWith(ID, { active: false });
    });

    it("200 for a non-root owner via the ownership bypass", async () => {
      h.setDomainOwner(ID, USER.id);
      svc.update.mockResolvedValueOnce({ id: ID, active: 1 });
      await api()
        .patch(`/api/v1/domains/${ID}/active`)
        .set(...asUser())
        .send({ active: true })
        .expect(200);
      h.setDomainOwner(ID, null);
    });

    it("400 on an invalid body (active not a boolean)", async () => {
      await api()
        .patch(`/api/v1/domains/${ID}/active`)
        .set(...asRoot())
        .send({ active: "yes" })
        .expect(400);
    });
  });

  describe("PATCH /domains/:domainId/owner (transferOwner)", () => {
    it("403 for a user without the elevated global grant", async () => {
      await api()
        .patch(`/api/v1/domains/${ID}/owner`)
        .set(...asUser())
        .send({ newOwnerId: UUID })
        .expect(403);
    });

    it("200 for root and forwards id, acting user, and new owner id", async () => {
      svc.transferOwner.mockResolvedValueOnce({ id: ID, ownerId: UUID });
      await api()
        .patch(`/api/v1/domains/${ID}/owner`)
        .set(...asRoot())
        .send({ newOwnerId: UUID })
        .expect(200);
      expect(svc.transferOwner).toHaveBeenCalledWith(ID, { id: ROOT.id, isRoot: true }, UUID);
    });

    it("400 on an invalid body (newOwnerId not a uuid)", async () => {
      await api()
        .patch(`/api/v1/domains/${ID}/owner`)
        .set(...asRoot())
        .send({ newOwnerId: "nope" })
        .expect(400);
    });
  });
});
