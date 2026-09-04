import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { ApiTokenController } from "../../src/core/auth/api-token/api-token.controller";
import { ApiTokenService } from "../../src/core/auth/api-token/api-token.service";
import { ApiTokenAccessService } from "../../src/core/auth/api-token/api-token-access.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// api-token routes are all gated on the global "api-tokens" resource
// (@UseGuards(GlobalPermissionGuard) + @RequireGlobalPermissions), so the real
// GlobalPermissionGuard runs against the harness cpg mock. `validate` is on the
// mock too because CombinedAuthGuard resolves ApiTokenService for the x-api-key
// strategy; these tests authenticate with a Bearer JWT so it stays untouched.
describe("ApiTokenController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    revoke: vi.fn(),
    regenerate: vi.fn(),
    reveal: vi.fn(),
    delete: vi.fn(),
    validate: vi.fn().mockResolvedValue(null),
  };
  const access = { list: vi.fn(), record: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [ApiTokenController],
      providers: [
        { provide: ApiTokenService, useValue: svc },
        { provide: ApiTokenAccessService, useValue: access },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const asUser = (t: string) => ({ Authorization: `Bearer ${t}` });

  describe("auth", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/api-tokens").expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get("/api/v1/api-tokens").set("Authorization", "Bearer nope").expect(401);
    });
  });

  describe("GET / (list)", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .get("/api/v1/api-tokens")
        .set(asUser(h.token(USER)))
        .expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "list-api-tokens");
      svc.list.mockResolvedValueOnce([]);
      await api()
        .get("/api/v1/api-tokens")
        .set(asUser(h.token(USER)))
        .expect(200);
    });
    it("200 for root (bypass) and forwards the caller id", async () => {
      svc.list.mockResolvedValueOnce([{ id: 1 }]);
      const res = await api()
        .get("/api/v1/api-tokens")
        .set(asUser(h.token(ROOT)))
        .expect(200);
      expect(res.body).toEqual([{ id: 1 }]);
      expect(svc.list).toHaveBeenCalledWith(ROOT.id);
    });
  });

  describe("POST / (create)", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .post("/api/v1/api-tokens")
        .set(asUser(h.token(USER)))
        .send({ name: "ci" })
        .expect(403);
    });
    it("201 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "create-api-token");
      svc.create.mockResolvedValueOnce({ id: 1, key: "sms_a.b" });
      await api()
        .post("/api/v1/api-tokens")
        .set(asUser(h.token(USER)))
        .send({ name: "ci" })
        .expect(201);
    });
    it("201 for root and forwards (callerId, body)", async () => {
      svc.create.mockResolvedValueOnce({ id: 9, key: "sms_x.y" });
      const res = await api()
        .post("/api/v1/api-tokens")
        .set(asUser(h.token(ROOT)))
        .send({ name: "deploy", allowedIps: ["10.0.0.1"] })
        .expect(201);
      expect(res.body.key).toBe("sms_x.y");
      // The caller's own rootness travels with the call: it is the ceiling a
      // requested scope is checked against.
      expect(svc.create).toHaveBeenCalledWith(ROOT.id, true, { name: "deploy", allowedIps: ["10.0.0.1"] });
    });
    it("400 on a missing name (zod)", async () => {
      await api()
        .post("/api/v1/api-tokens")
        .set(asUser(h.token(ROOT)))
        .send({})
        .expect(400);
    });
    it("400 on an invalid IP in allowedIps (zod)", async () => {
      await api()
        .post("/api/v1/api-tokens")
        .set(asUser(h.token(ROOT)))
        .send({ name: "x", allowedIps: ["not-an-ip"] })
        .expect(400);
    });
  });

  describe("GET /:id/secret (reveal)", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .get("/api/v1/api-tokens/1/secret")
        .set(asUser(h.token(USER)))
        .expect(403);
    });
    it("403 for a user who may only list, reading a key back being handing one out", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "list-api-tokens");
      await api()
        .get("/api/v1/api-tokens/1/secret")
        .set(asUser(h.token(USER)))
        .expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "regenerate-api-token");
      svc.reveal.mockResolvedValueOnce({ id: 1, key: "sms_a.b" });
      await api()
        .get("/api/v1/api-tokens/1/secret")
        .set(asUser(h.token(USER)))
        .expect(200);
    });
    it("200 for root, forwards (callerId, id) and is never cached", async () => {
      svc.reveal.mockResolvedValueOnce({ id: 7, name: "ci", clientId: "cid", key: "sms_cid.s3cret" });
      const res = await api()
        .get("/api/v1/api-tokens/7/secret")
        .set(asUser(h.token(ROOT)))
        .expect(200);
      expect(res.body.key).toBe("sms_cid.s3cret");
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(svc.reveal).toHaveBeenCalledWith(ROOT.id, 7);
    });
    it("400 when :id is not an integer", async () => {
      await api()
        .get("/api/v1/api-tokens/abc/secret")
        .set(asUser(h.token(ROOT)))
        .expect(400);
    });
  });

  describe("GET /:id/access (access trail)", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .get("/api/v1/api-tokens/1/access")
        .set(asUser(h.token(USER)))
        .expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "list-api-tokens");
      access.list.mockResolvedValueOnce({ items: [], total: 0 });
      await api()
        .get("/api/v1/api-tokens/1/access")
        .set(asUser(h.token(USER)))
        .expect(200);
    });
    it("200 for root and forwards (callerId, id, pagination)", async () => {
      access.list.mockResolvedValueOnce({ items: [{ id: "1" }], total: 4927 });
      const res = await api()
        .get("/api/v1/api-tokens/7/access?limit=25&offset=50&sortBy=durationMs&sortDir=asc&search=domains")
        .set(asUser(h.token(ROOT)))
        .expect(200);
      expect(res.body.total).toBe(4927);
      expect(access.list).toHaveBeenCalledWith(ROOT.id, 7, {
        limit: 25,
        offset: 50,
        sortBy: "durationMs",
        sortDir: "asc",
        search: "domains",
      });
    });
    it("400 when :id is not an integer", async () => {
      await api()
        .get("/api/v1/api-tokens/abc/access")
        .set(asUser(h.token(ROOT)))
        .expect(400);
    });
    it("400 on a page size the API does not serve (zod)", async () => {
      await api()
        .get("/api/v1/api-tokens/1/access?limit=999")
        .set(asUser(h.token(ROOT)))
        .expect(400);
    });
  });

  describe("PATCH /:id (update)", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .patch("/api/v1/api-tokens/1")
        .set(asUser(h.token(USER)))
        .send({ name: "n" })
        .expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "edit-api-token");
      svc.update.mockResolvedValueOnce({ id: 1 });
      await api()
        .patch("/api/v1/api-tokens/1")
        .set(asUser(h.token(USER)))
        .send({ name: "n" })
        .expect(200);
    });
    it("200 for root and forwards (callerId, id, body)", async () => {
      svc.update.mockResolvedValueOnce({ id: 7, name: "renamed" });
      await api()
        .patch("/api/v1/api-tokens/7")
        .set(asUser(h.token(ROOT)))
        .send({ name: "renamed" })
        .expect(200);
      expect(svc.update).toHaveBeenCalledWith(ROOT.id, true, 7, { name: "renamed" });
    });
    it("400 when :id is not an integer", async () => {
      await api()
        .patch("/api/v1/api-tokens/abc")
        .set(asUser(h.token(ROOT)))
        .send({ name: "n" })
        .expect(400);
    });
    it("400 on an invalid body (zod)", async () => {
      await api()
        .patch("/api/v1/api-tokens/1")
        .set(asUser(h.token(ROOT)))
        .send({ allowedIps: ["bad"] })
        .expect(400);
    });
  });

  describe("POST /:id/revoke", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .post("/api/v1/api-tokens/1/revoke")
        .set(asUser(h.token(USER)))
        .expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "revoke-api-token");
      svc.revoke.mockResolvedValueOnce({ id: 1 });
      await api()
        .post("/api/v1/api-tokens/1/revoke")
        .set(asUser(h.token(USER)))
        .expect(200);
    });
    it("200 for root and forwards (callerId, id)", async () => {
      svc.revoke.mockResolvedValueOnce({ id: 3 });
      await api()
        .post("/api/v1/api-tokens/3/revoke")
        .set(asUser(h.token(ROOT)))
        .expect(200);
      expect(svc.revoke).toHaveBeenCalledWith(ROOT.id, 3);
    });
    it("400 when :id is not an integer", async () => {
      await api()
        .post("/api/v1/api-tokens/x/revoke")
        .set(asUser(h.token(ROOT)))
        .expect(400);
    });
  });

  describe("POST /:id/regenerate", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .post("/api/v1/api-tokens/1/regenerate")
        .set(asUser(h.token(USER)))
        .expect(403);
    });
    it("201 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "regenerate-api-token");
      svc.regenerate.mockResolvedValueOnce({ id: 1, key: "sms_a.b" });
      await api()
        .post("/api/v1/api-tokens/1/regenerate")
        .set(asUser(h.token(USER)))
        .expect(201);
    });
    it("201 for root and forwards (callerId, id)", async () => {
      svc.regenerate.mockResolvedValueOnce({ id: 4, key: "sms_c.d" });
      await api()
        .post("/api/v1/api-tokens/4/regenerate")
        .set(asUser(h.token(ROOT)))
        .expect(201);
      expect(svc.regenerate).toHaveBeenCalledWith(ROOT.id, 4);
    });
  });

  describe("DELETE /:id", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .delete("/api/v1/api-tokens/1")
        .set(asUser(h.token(USER)))
        .expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "delete-api-token");
      svc.delete.mockResolvedValueOnce(undefined);
      await api()
        .delete("/api/v1/api-tokens/1")
        .set(asUser(h.token(USER)))
        .expect(200);
    });
    it("200 for root and forwards (callerId, id)", async () => {
      svc.delete.mockResolvedValueOnce(undefined);
      await api()
        .delete("/api/v1/api-tokens/5")
        .set(asUser(h.token(ROOT)))
        .expect(200);
      expect(svc.delete).toHaveBeenCalledWith(ROOT.id, 5);
    });
    it("400 when :id is not an integer", async () => {
      await api()
        .delete("/api/v1/api-tokens/nope")
        .set(asUser(h.token(ROOT)))
        .expect(400);
    });
  });
});
