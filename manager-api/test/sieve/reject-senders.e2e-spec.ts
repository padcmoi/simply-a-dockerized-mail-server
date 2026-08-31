import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { RejectSendersController } from "../../src/api/sieve/reject-senders/reject-senders.controller";
import { RejectSendersService } from "../../src/api/sieve/reject-senders/reject-senders.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("RejectSendersController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    list: vi.fn(),
    create: vi.fn(),
    toggle: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [RejectSendersController],
      providers: [{ provide: RejectSendersService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());

  describe("auth", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/sieve/reject-senders").expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get("/api/v1/sieve/reject-senders").set("Authorization", "Bearer nope").expect(401);
    });
  });

  describe("ACL", () => {
    it("403 for an authenticated user without the permission", async () => {
      await api().get("/api/v1/sieve/reject-senders").set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("sieve", "access", "list-reject-senders");
      svc.list.mockResolvedValueOnce([]);
      await api().get("/api/v1/sieve/reject-senders").set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
    });
    it("200 for root regardless of grants (bypass)", async () => {
      svc.list.mockResolvedValueOnce([]);
      await api().get("/api/v1/sieve/reject-senders").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
    });
  });

  describe("behavior + validation", () => {
    it("POST creates and returns the service result", async () => {
      svc.create.mockResolvedValueOnce({ id: 1, sender: "spam@x.com", enabled: 1 });
      const res = await api()
        .post("/api/v1/sieve/reject-senders")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ sender: "spam@x.com" })
        .expect(201);
      expect(res.body.sender).toBe("spam@x.com");
      expect(svc.create).toHaveBeenCalledWith("spam@x.com");
    });

    it("POST 400 on an invalid body (zod)", async () => {
      await api()
        .post("/api/v1/sieve/reject-senders")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ notSender: 1 })
        .expect(400);
    });

    it("PATCH toggles and forwards id + enabled to the service", async () => {
      svc.toggle.mockResolvedValueOnce({ id: 7, enabled: 0 });
      await api()
        .patch("/api/v1/sieve/reject-senders/7")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ enabled: false })
        .expect(200);
      expect(svc.toggle).toHaveBeenCalledWith(7, false);
    });

    it("PATCH 400 when :id is not an integer", async () => {
      await api()
        .patch("/api/v1/sieve/reject-senders/abc")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ enabled: true })
        .expect(400);
    });

    it("DELETE forwards to the service", async () => {
      svc.remove.mockResolvedValueOnce({ ok: true });
      await api().delete("/api/v1/sieve/reject-senders/5").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.remove).toHaveBeenCalledWith(5);
    });
  });
});
