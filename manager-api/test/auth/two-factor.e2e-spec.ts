import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { TwoFactorController } from "../../src/core/auth/two-factor/two-factor.controller";
import { TwoFactorService } from "../../src/core/auth/two-factor/two-factor.service";
import { buildHarness, USER, type Harness } from "../helpers/e2e";

type HttpMethod = "get" | "post" | "delete";

// The caller's own second factor: authenticated, no permission, JWT only. An
// API key is refused whatever its scopes, since switching off what protects a
// sign-in is not something a key acts for.
describe("TwoFactorController (e2e: JWT only, no ACL)", () => {
  let h: Harness;
  const svc = {
    status: vi.fn(),
    beginSetup: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [TwoFactorController],
      providers: [{ provide: TwoFactorService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const call = (method: HttpMethod, path: string) => api()[method](path);
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const BASE = "/api/v1/auth/jwt/me/two-factor";

  const ROUTES: Array<[HttpMethod, string]> = [
    ["get", BASE],
    ["post", `${BASE}/setup`],
    ["post", `${BASE}/enable`],
    ["delete", BASE],
    ["post", `${BASE}/recovery-codes`],
  ];

  describe("auth (401)", () => {
    for (const [method, path] of ROUTES) {
      it(`401 without a token: ${method.toUpperCase()} ${path}`, async () => {
        await call(method, path).expect(401);
      });
      it(`401 with a garbage bearer token: ${method.toUpperCase()} ${path}`, async () => {
        await call(method, path).set("Authorization", "Bearer nope").expect(401);
      });
      it(`401 with an API key: ${method.toUpperCase()} ${path}`, async () => {
        await call(method, path).set("x-api-key", "smk_whatever").expect(401);
      });
    }
  });

  describe("GET (status)", () => {
    it("200 and forwards the caller id", async () => {
      svc.status.mockResolvedValueOnce({ enabled: false, enabledAt: null, recoveryCodesLeft: 0 });
      const res = await api()
        .get(BASE)
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(res.body).toEqual({ enabled: false, enabledAt: null, recoveryCodesLeft: 0 });
      expect(svc.status).toHaveBeenCalledWith(USER.id);
    });
  });

  describe("POST setup", () => {
    it("200 and forwards the caller id and email", async () => {
      svc.beginSetup.mockResolvedValueOnce({ secret: "S", otpauthUri: "otpauth://totp/x" });
      const res = await api()
        .post(`${BASE}/setup`)
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(res.body).toEqual({ secret: "S", otpauthUri: "otpauth://totp/x" });
      expect(svc.beginSetup).toHaveBeenCalledWith(USER.id, USER.email);
    });
  });

  describe("POST enable", () => {
    it("200 and forwards (callerId, code)", async () => {
      svc.enable.mockResolvedValueOnce({ recoveryCodes: ["A"] });
      const res = await api()
        .post(`${BASE}/enable`)
        .set(bearer(h.token(USER)))
        .send({ code: "123 456" })
        .expect(200);
      expect(res.body).toEqual({ recoveryCodes: ["A"] });
      expect(svc.enable).toHaveBeenCalledWith(USER.id, "123 456");
    });
    it("400 on a code that is too short (zod)", async () => {
      await api()
        .post(`${BASE}/enable`)
        .set(bearer(h.token(USER)))
        .send({ code: "12" })
        .expect(400);
      expect(svc.enable).not.toHaveBeenCalled();
    });
    it("400 on a missing code (zod)", async () => {
      await api()
        .post(`${BASE}/enable`)
        .set(bearer(h.token(USER)))
        .send({})
        .expect(400);
    });
    it("400 on an unknown field (zod strict)", async () => {
      await api()
        .post(`${BASE}/enable`)
        .set(bearer(h.token(USER)))
        .send({ code: "123456", extra: 1 })
        .expect(400);
    });
  });

  describe("DELETE (disable)", () => {
    it("200 and forwards (callerId, code)", async () => {
      svc.disable.mockResolvedValueOnce({ disabled: true });
      const res = await api()
        .delete(BASE)
        .set(bearer(h.token(USER)))
        .send({ code: "ABCDE-FGHJK" })
        .expect(200);
      expect(res.body).toEqual({ disabled: true });
      expect(svc.disable).toHaveBeenCalledWith(USER.id, "ABCDE-FGHJK");
    });
    it("400 on a code that is too long (zod)", async () => {
      await api()
        .delete(BASE)
        .set(bearer(h.token(USER)))
        .send({ code: "x".repeat(33) })
        .expect(400);
      expect(svc.disable).not.toHaveBeenCalled();
    });
  });

  describe("POST recovery-codes", () => {
    it("200 and forwards (callerId, code)", async () => {
      svc.regenerateRecoveryCodes.mockResolvedValueOnce({ recoveryCodes: ["B"] });
      const res = await api()
        .post(`${BASE}/recovery-codes`)
        .set(bearer(h.token(USER)))
        .send({ code: "654321" })
        .expect(200);
      expect(res.body).toEqual({ recoveryCodes: ["B"] });
      expect(svc.regenerateRecoveryCodes).toHaveBeenCalledWith(USER.id, "654321");
    });
    it("400 on a missing code (zod)", async () => {
      await api()
        .post(`${BASE}/recovery-codes`)
        .set(bearer(h.token(USER)))
        .send({})
        .expect(400);
    });
  });
});
