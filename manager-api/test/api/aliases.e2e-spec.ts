import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AliasesController } from "../../src/api/domains/aliases/aliases.controller";
import { AliasesService } from "../../src/api/domains/aliases/aliases.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("AliasesController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    resolveDomain: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AliasesController],
      providers: [{ provide: AliasesService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  describe("auth (401)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/domains/1/aliases").expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get("/api/v1/domains/1/aliases").set("Authorization", "Bearer nope").expect(401);
    });
  });

  describe("ACL (403 vs 2xx)", () => {
    it("403 for an authenticated user without any grant", async () => {
      await api().get("/api/v1/domains/1/aliases").set("Authorization", auth(USER)).expect(403);
    });

    it("200 for a non-root user via the full domain grant chain", async () => {
      h.cpg.grantGlobal("domains", "access");
      h.cpg.grantDomain(1, "domain", "access");
      h.cpg.grantDomain(1, "aliases", "access", "list-aliases");
      svc.resolveDomain.mockResolvedValueOnce("example.test");
      svc.list.mockResolvedValueOnce({ items: [], total: 0 });
      await api().get("/api/v1/domains/1/aliases").set("Authorization", auth(USER)).expect(200);
    });

    it("200 for a non-root user through the ownership bypass (no grant)", async () => {
      h.setDomainOwner(42, USER.id);
      svc.resolveDomain.mockResolvedValueOnce("owned.test");
      svc.list.mockResolvedValueOnce({ items: [], total: 0 });
      await api().get("/api/v1/domains/42/aliases").set("Authorization", auth(USER)).expect(200);
    });
  });

  describe("GET / (list)", () => {
    it("200 for root and forwards the resolved domain + parsed query", async () => {
      svc.resolveDomain.mockResolvedValueOnce("example.test");
      svc.list.mockResolvedValueOnce({ items: [{ id: 1 }], total: 1 });
      const res = await api().get("/api/v1/domains/3/aliases?limit=10&sortBy=source&sortDir=asc").set("Authorization", auth(ROOT)).expect(200);
      expect(res.body).toEqual({ items: [{ id: 1 }], total: 1 });
      expect(svc.resolveDomain).toHaveBeenCalledWith(3);
      expect(svc.list).toHaveBeenCalledWith("example.test", expect.objectContaining({ limit: 10, offset: 0, sortBy: "source", sortDir: "asc" }));
    });

    it("400 when :domainId is not an integer", async () => {
      await api().get("/api/v1/domains/abc/aliases").set("Authorization", auth(ROOT)).expect(400);
    });

    it("400 on an invalid pagination query (zod)", async () => {
      await api().get("/api/v1/domains/1/aliases?limit=7").set("Authorization", auth(ROOT)).expect(400);
    });
  });

  describe("GET /:id", () => {
    it("200 for root and forwards id + domain", async () => {
      svc.resolveDomain.mockResolvedValueOnce("example.test");
      svc.get.mockResolvedValueOnce({ id: 5, source: "a@example.test" });
      await api().get("/api/v1/domains/1/aliases/5").set("Authorization", auth(ROOT)).expect(200);
      expect(svc.get).toHaveBeenCalledWith(5, "example.test");
    });

    it("400 when :id is not an integer", async () => {
      await api().get("/api/v1/domains/1/aliases/abc").set("Authorization", auth(ROOT)).expect(400);
    });
  });

  describe("POST / (create)", () => {
    it("201 for root and forwards the body + domain", async () => {
      svc.resolveDomain.mockResolvedValueOnce("example.test");
      svc.create.mockResolvedValueOnce({ id: 9, source: "sales@example.test" });
      const res = await api()
        .post("/api/v1/domains/1/aliases")
        .set("Authorization", auth(ROOT))
        .send({ localPart: "sales", destination: "team@example.test" })
        .expect(201);
      expect(res.body.source).toBe("sales@example.test");
      expect(svc.create).toHaveBeenCalledWith({ localPart: "sales", destination: "team@example.test" }, "example.test");
    });

    it("400 on an invalid body (missing localPart / bad email)", async () => {
      await api().post("/api/v1/domains/1/aliases").set("Authorization", auth(ROOT)).send({ destination: "not-an-email" }).expect(400);
    });

    it("400 on an unknown extra key (strict schema)", async () => {
      await api()
        .post("/api/v1/domains/1/aliases")
        .set("Authorization", auth(ROOT))
        .send({ localPart: "sales", destination: "team@example.test", source: "hack@evil.test" })
        .expect(400);
    });
  });

  describe("PATCH /:id (update)", () => {
    it("200 for root and forwards id + body + domain", async () => {
      svc.resolveDomain.mockResolvedValueOnce("example.test");
      svc.update.mockResolvedValueOnce({ id: 5, destination: "new@example.test" });
      await api()
        .patch("/api/v1/domains/1/aliases/5")
        .set("Authorization", auth(ROOT))
        .send({ destination: "new@example.test" })
        .expect(200);
      expect(svc.update).toHaveBeenCalledWith(5, { destination: "new@example.test" }, "example.test");
    });

    it("400 when :id is not an integer", async () => {
      await api().patch("/api/v1/domains/1/aliases/abc").set("Authorization", auth(ROOT)).send({ destination: "a@b.com" }).expect(400);
    });

    it("400 on an invalid body (bad email)", async () => {
      await api().patch("/api/v1/domains/1/aliases/5").set("Authorization", auth(ROOT)).send({ destination: "nope" }).expect(400);
    });
  });

  describe("DELETE /:id", () => {
    it("200 for root and forwards id + domain", async () => {
      svc.resolveDomain.mockResolvedValueOnce("example.test");
      svc.remove.mockResolvedValueOnce({ ok: true });
      await api().delete("/api/v1/domains/1/aliases/5").set("Authorization", auth(ROOT)).expect(200);
      expect(svc.remove).toHaveBeenCalledWith(5, "example.test");
    });

    it("400 when :id is not an integer", async () => {
      await api().delete("/api/v1/domains/1/aliases/abc").set("Authorization", auth(ROOT)).expect(400);
    });
  });
});
