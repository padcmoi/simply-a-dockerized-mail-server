import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { RecipientsController } from "../../src/api/domains/recipients/recipients.controller";
import { RecipientsService } from "../../src/api/domains/recipients/recipients.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const DOMAIN_ID = 12;
const FQDN = "example.com";
const base = `/api/v1/domains/${DOMAIN_ID}/recipients`;

type Method = "get" | "post" | "patch" | "delete";

describe("RecipientsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    resolveDomain: vi.fn(),
    list: vi.fn(),
    headroom: vi.fn(),
    get: vi.fn(),
    getWithUsage: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [RecipientsController],
      providers: [{ provide: RecipientsService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    // Ownership never leaks between tests (a stray owner would turn a 403 case
    // into a 200); the ownership case sets it back inside its own test.
    h.setDomainOwner(DOMAIN_ID, null);
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const call = (m: Method, path: string) => {
    const agent = api();
    return m === "get" ? agent.get(path) : m === "post" ? agent.post(path) : m === "patch" ? agent.patch(path) : agent.delete(path);
  };
  // The whole chain a non-root needs on a :domainId route for a resource that
  // is not `domain` itself (see DomainPermissionGuard): global domains:access
  // prerequisite + the domain.access gate + the resource's own actions.
  const grant = (...actions: string[]) => {
    h.cpg.grantGlobal("domains", "access");
    h.cpg.grantDomain(DOMAIN_ID, "domain", "access");
    h.cpg.grantDomain(DOMAIN_ID, "recipients", "access", ...actions);
  };

  // Every route the controller exposes, used to sweep 401/403 uniformly. Guards
  // run before pipes, so a canonical (valid-shaped) path is enough to reach them.
  const routes: { name: string; method: Method; path: string }[] = [
    { name: "GET list", method: "get", path: base },
    { name: "GET headroom", method: "get", path: `${base}/headroom` },
    { name: "GET :id", method: "get", path: `${base}/5` },
    { name: "POST create", method: "post", path: base },
    { name: "PATCH :id", method: "patch", path: `${base}/5` },
    { name: "DELETE :id", method: "delete", path: `${base}/5` },
  ];

  describe("auth (401)", () => {
    for (const r of routes) {
      it(`401 without a token -- ${r.name}`, async () => {
        await call(r.method, r.path).expect(401);
      });
      it(`401 with a garbage bearer token -- ${r.name}`, async () => {
        await call(r.method, r.path).set("Authorization", "Bearer nope").expect(401);
      });
    }
  });

  describe("ACL (403 for a user without any grant)", () => {
    for (const r of routes) {
      it(`403 for USER -- ${r.name}`, async () => {
        await call(r.method, r.path).set("Authorization", user()).expect(403);
      });
    }
  });

  describe("GET / (list)", () => {
    it("200 for ROOT, forwards the resolved domain + parsed query to the service", async () => {
      svc.resolveDomain.mockResolvedValueOnce(FQDN);
      svc.list.mockResolvedValueOnce({ items: [], total: 0 });
      const res = await api().get(`${base}?limit=10&sortBy=email&sortDir=asc`).set("Authorization", root()).expect(200);
      expect(res.body).toEqual({ items: [], total: 0 });
      expect(svc.resolveDomain).toHaveBeenCalledWith(DOMAIN_ID);
      expect(svc.list).toHaveBeenCalledWith(FQDN, expect.objectContaining({ limit: 10, sortBy: "email", sortDir: "asc" }));
    });

    it("200 for a non-root user granted the full chain (domains:access + domain:access + recipients:list)", async () => {
      grant("list-recipients");
      svc.resolveDomain.mockResolvedValueOnce(FQDN);
      svc.list.mockResolvedValueOnce([]);
      await api().get(base).set("Authorization", user()).expect(200);
      expect(svc.list).toHaveBeenCalledWith(FQDN, expect.any(Object));
    });

    it("400 on an invalid pagination query (limit not 10/25/50)", async () => {
      await api().get(`${base}?limit=7`).set("Authorization", root()).expect(400);
      expect(svc.list).not.toHaveBeenCalled();
    });

    it("400 when :domainId is not an integer (ParseIntPipe, root bypasses the guard)", async () => {
      await api().get("/api/v1/domains/abc/recipients").set("Authorization", root()).expect(400);
      expect(svc.resolveDomain).not.toHaveBeenCalled();
    });
  });

  describe("GET /headroom", () => {
    it("200 for ROOT, forwards the resolved domain to the service", async () => {
      svc.resolveDomain.mockResolvedValueOnce(FQDN);
      svc.headroom.mockResolvedValueOnce({ domainQuota: 100, allocated: 30, available: 70 });
      const res = await api().get(`${base}/headroom`).set("Authorization", root()).expect(200);
      expect(res.body).toEqual({ domainQuota: 100, allocated: 30, available: 70 });
      expect(svc.headroom).toHaveBeenCalledWith(FQDN);
    });

    it("200 for a non-root user who owns the domain (ownership bypass, no grant)", async () => {
      h.setDomainOwner(DOMAIN_ID, USER.id);
      svc.resolveDomain.mockResolvedValueOnce(FQDN);
      svc.headroom.mockResolvedValueOnce({ domainQuota: 1, allocated: 0, available: 1 });
      await api().get(`${base}/headroom`).set("Authorization", user()).expect(200);
      expect(svc.headroom).toHaveBeenCalledWith(FQDN);
    });

    it("400 when :domainId is not an integer", async () => {
      await api().get("/api/v1/domains/abc/recipients/headroom").set("Authorization", root()).expect(400);
    });
  });

  describe("GET /:id", () => {
    it("200 for ROOT, forwards id + domain to the service", async () => {
      svc.resolveDomain.mockResolvedValueOnce(FQDN);
      svc.getWithUsage.mockResolvedValueOnce({ id: 5, email: "jdoe@example.com", usedBytes: "0" });
      const res = await api().get(`${base}/5`).set("Authorization", root()).expect(200);
      expect(res.body).toMatchObject({ id: 5, usedBytes: "0" });
      expect(svc.getWithUsage).toHaveBeenCalledWith(5, FQDN);
    });

    it("400 when :id is not an integer", async () => {
      await api().get(`${base}/abc`).set("Authorization", root()).expect(400);
      expect(svc.getWithUsage).not.toHaveBeenCalled();
    });
  });

  describe("POST / (create)", () => {
    it("201 for ROOT, forwards the parsed body + domain to the service", async () => {
      svc.resolveDomain.mockResolvedValueOnce(FQDN);
      svc.create.mockResolvedValueOnce({ id: 1, email: "jdoe@example.com" });
      const body = { localPart: "jdoe", password: "correcthorse", quota: 104857600, active: true };
      const res = await api().post(base).set("Authorization", root()).send(body).expect(201);
      expect(res.body).toMatchObject({ id: 1, email: "jdoe@example.com" });
      expect(svc.create).toHaveBeenCalledWith(
        expect.objectContaining({ localPart: "jdoe", quota: 104857600, active: true }),
        FQDN
      );
    });

    it("400 on an invalid body (missing required fields / zod)", async () => {
      await api().post(base).set("Authorization", root()).send({ localPart: "jdoe" }).expect(400);
      expect(svc.create).not.toHaveBeenCalled();
    });

    it("400 when :domainId is not an integer", async () => {
      await api()
        .post("/api/v1/domains/abc/recipients")
        .set("Authorization", root())
        .send({ localPart: "jdoe", password: "correcthorse", quota: 104857600 })
        .expect(400);
    });
  });

  describe("PATCH /:id (update)", () => {
    it("200 for ROOT, forwards id + parsed body + domain to the service", async () => {
      svc.resolveDomain.mockResolvedValueOnce(FQDN);
      svc.update.mockResolvedValueOnce({ id: 5, quota: "209715200" });
      const res = await api().patch(`${base}/5`).set("Authorization", root()).send({ quota: 209715200, active: false }).expect(200);
      expect(res.body).toMatchObject({ id: 5 });
      expect(svc.update).toHaveBeenCalledWith(5, expect.objectContaining({ quota: 209715200, active: false }), FQDN);
    });

    it("400 on an invalid body (quota below the 1 MB minimum)", async () => {
      await api().patch(`${base}/5`).set("Authorization", root()).send({ quota: 500 }).expect(400);
      expect(svc.update).not.toHaveBeenCalled();
    });

    it("400 when :id is not an integer", async () => {
      await api().patch(`${base}/abc`).set("Authorization", root()).send({ active: true }).expect(400);
    });
  });

  describe("DELETE /:id (remove)", () => {
    it("200 for ROOT, forwards id + domain to the service", async () => {
      svc.resolveDomain.mockResolvedValueOnce(FQDN);
      svc.remove.mockResolvedValueOnce({ ok: true });
      const res = await api().delete(`${base}/5`).set("Authorization", root()).expect(200);
      expect(res.body).toEqual({ ok: true });
      expect(svc.remove).toHaveBeenCalledWith(5, FQDN);
    });

    it("400 when :id is not an integer", async () => {
      await api().delete(`${base}/abc`).set("Authorization", root()).expect(400);
      expect(svc.remove).not.toHaveBeenCalled();
    });
  });
});
