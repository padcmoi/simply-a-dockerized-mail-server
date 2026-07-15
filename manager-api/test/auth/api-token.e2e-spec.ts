import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { ApiTokenController } from "../../src/core/auth/api-token/api-token.controller";
import { ApiTokenService } from "../../src/core/auth/api-token/api-token.service";
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
    delete: vi.fn(),
    validate: vi.fn().mockResolvedValue(null),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [ApiTokenController],
      providers: [{ provide: ApiTokenService, useValue: svc }],
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
      await api().get("/api/v1/api-tokens").set(asUser(h.token(USER))).expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "list-api-tokens");
      svc.list.mockResolvedValueOnce([]);
      await api().get("/api/v1/api-tokens").set(asUser(h.token(USER))).expect(200);
    });
    it("200 for root (bypass) and forwards the caller id", async () => {
      svc.list.mockResolvedValueOnce([{ id: 1 }]);
      const res = await api().get("/api/v1/api-tokens").set(asUser(h.token(ROOT))).expect(200);
      expect(res.body).toEqual([{ id: 1 }]);
      expect(svc.list).toHaveBeenCalledWith(ROOT.id);
    });
  });

  describe("POST / (create)", () => {
    it("403 for a user without the permission", async () => {
      await api().post("/api/v1/api-tokens").set(asUser(h.token(USER))).send({ name: "ci" }).expect(403);
    });
    it("201 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "create-api-token");
      svc.create.mockResolvedValueOnce({ id: 1, key: "sms_a.b" });
      await api().post("/api/v1/api-tokens").set(asUser(h.token(USER))).send({ name: "ci" }).expect(201);
    });
    it("201 for root and forwards (callerId, body)", async () => {
      svc.create.mockResolvedValueOnce({ id: 9, key: "sms_x.y" });
      const res = await api()
        .post("/api/v1/api-tokens")
        .set(asUser(h.token(ROOT)))
        .send({ name: "deploy", allowedIps: ["10.0.0.1"] })
        .expect(201);
      expect(res.body.key).toBe("sms_x.y");
      expect(svc.create).toHaveBeenCalledWith(ROOT.id, { name: "deploy", allowedIps: ["10.0.0.1"] });
    });
    it("400 on a missing name (zod)", async () => {
      await api().post("/api/v1/api-tokens").set(asUser(h.token(ROOT))).send({}).expect(400);
    });
    it("400 on an invalid IP in allowedIps (zod)", async () => {
      await api()
        .post("/api/v1/api-tokens")
        .set(asUser(h.token(ROOT)))
        .send({ name: "x", allowedIps: ["not-an-ip"] })
        .expect(400);
    });
  });

  describe("PATCH /:id (update)", () => {
    it("403 for a user without the permission", async () => {
      await api().patch("/api/v1/api-tokens/1").set(asUser(h.token(USER))).send({ name: "n" }).expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "edit-api-token");
      svc.update.mockResolvedValueOnce({ id: 1 });
      await api().patch("/api/v1/api-tokens/1").set(asUser(h.token(USER))).send({ name: "n" }).expect(200);
    });
    it("200 for root and forwards (callerId, id, body)", async () => {
      svc.update.mockResolvedValueOnce({ id: 7, name: "renamed" });
      await api().patch("/api/v1/api-tokens/7").set(asUser(h.token(ROOT))).send({ name: "renamed" }).expect(200);
      expect(svc.update).toHaveBeenCalledWith(ROOT.id, 7, { name: "renamed" });
    });
    it("400 when :id is not an integer", async () => {
      await api().patch("/api/v1/api-tokens/abc").set(asUser(h.token(ROOT))).send({ name: "n" }).expect(400);
    });
    it("400 on an invalid body (zod)", async () => {
      await api().patch("/api/v1/api-tokens/1").set(asUser(h.token(ROOT))).send({ allowedIps: ["bad"] }).expect(400);
    });
  });

  describe("POST /:id/revoke", () => {
    it("403 for a user without the permission", async () => {
      await api().post("/api/v1/api-tokens/1/revoke").set(asUser(h.token(USER))).expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "revoke-api-token");
      svc.revoke.mockResolvedValueOnce({ id: 1 });
      await api().post("/api/v1/api-tokens/1/revoke").set(asUser(h.token(USER))).expect(200);
    });
    it("200 for root and forwards (callerId, id)", async () => {
      svc.revoke.mockResolvedValueOnce({ id: 3 });
      await api().post("/api/v1/api-tokens/3/revoke").set(asUser(h.token(ROOT))).expect(200);
      expect(svc.revoke).toHaveBeenCalledWith(ROOT.id, 3);
    });
    it("400 when :id is not an integer", async () => {
      await api().post("/api/v1/api-tokens/x/revoke").set(asUser(h.token(ROOT))).expect(400);
    });
  });

  describe("POST /:id/regenerate", () => {
    it("403 for a user without the permission", async () => {
      await api().post("/api/v1/api-tokens/1/regenerate").set(asUser(h.token(USER))).expect(403);
    });
    it("201 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "regenerate-api-token");
      svc.regenerate.mockResolvedValueOnce({ id: 1, key: "sms_a.b" });
      await api().post("/api/v1/api-tokens/1/regenerate").set(asUser(h.token(USER))).expect(201);
    });
    it("201 for root and forwards (callerId, id)", async () => {
      svc.regenerate.mockResolvedValueOnce({ id: 4, key: "sms_c.d" });
      await api().post("/api/v1/api-tokens/4/regenerate").set(asUser(h.token(ROOT))).expect(201);
      expect(svc.regenerate).toHaveBeenCalledWith(ROOT.id, 4);
    });
  });

  describe("DELETE /:id", () => {
    it("403 for a user without the permission", async () => {
      await api().delete("/api/v1/api-tokens/1").set(asUser(h.token(USER))).expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("api-tokens", "access", "delete-api-token");
      svc.delete.mockResolvedValueOnce(undefined);
      await api().delete("/api/v1/api-tokens/1").set(asUser(h.token(USER))).expect(200);
    });
    it("200 for root and forwards (callerId, id)", async () => {
      svc.delete.mockResolvedValueOnce(undefined);
      await api().delete("/api/v1/api-tokens/5").set(asUser(h.token(ROOT))).expect(200);
      expect(svc.delete).toHaveBeenCalledWith(ROOT.id, 5);
    });
    it("400 when :id is not an integer", async () => {
      await api().delete("/api/v1/api-tokens/nope").set(asUser(h.token(ROOT))).expect(400);
    });
  });
});
