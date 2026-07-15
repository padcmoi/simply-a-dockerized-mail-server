import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AccountsSessionsController } from "../../src/api/accounts/sessions/sessions.controller";
import { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// A well-formed uuid so ParseUUIDPipe passes and only the guard / body pipe can
// reject; a deliberately malformed one is used for the 400 assertions.
const UUID = "11111111-1111-1111-1111-111111111111";
const SESSION_ID = 42;

// Admin, per-account session views. Every route delegates to JwtAuthService,
// mocked here so only the auth + ACL contract and the parameter parsing/forwarding
// are exercised.
describe("AccountsSessionsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const jwtAuth = {
    listSessionsOverview: vi.fn(),
    listActiveSessions: vi.fn(),
    listSessionHistory: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllActiveSessions: vi.fn(),
    purgeAccountSessionHistory: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AccountsSessionsController],
      providers: [{ provide: JwtAuthService, useValue: jwtAuth }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const call = (method: string, path: string) => (api() as unknown as Record<string, (p: string) => request.Test>)[method](path);

  // Every guarded route, exercised for the two auth failures in one sweep.
  const PROTECTED: Array<[string, string]> = [
    ["get", "/api/v1/accounts/sessions/overview"],
    ["get", `/api/v1/accounts/${UUID}/sessions/active`],
    ["get", `/api/v1/accounts/${UUID}/sessions/history`],
    ["delete", `/api/v1/accounts/${UUID}/sessions/history`],
    ["delete", `/api/v1/accounts/${UUID}/sessions/${SESSION_ID}`],
    ["delete", `/api/v1/accounts/${UUID}/sessions`],
  ];

  describe("auth (401)", () => {
    for (const [method, path] of PROTECTED) {
      it(`401 without a token: ${method.toUpperCase()} ${path}`, async () => {
        await call(method, path).expect(401);
      });
      it(`401 with a garbage bearer token: ${method.toUpperCase()} ${path}`, async () => {
        await call(method, path).set("Authorization", "Bearer nope").expect(401);
      });
    }
  });

  describe("GET /accounts/sessions/overview", () => {
    it("403 for a user without the permission", async () => {
      await api().get("/api/v1/accounts/sessions/overview").set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted view-account-sessions", async () => {
      h.cpg.grantGlobal("accounts", "access", "view-account-sessions");
      jwtAuth.listSessionsOverview.mockResolvedValueOnce([]);
      await api().get("/api/v1/accounts/sessions/overview").set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
    });

    it("200 for root", async () => {
      jwtAuth.listSessionsOverview.mockResolvedValueOnce([]);
      await api().get("/api/v1/accounts/sessions/overview").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(jwtAuth.listSessionsOverview).toHaveBeenCalled();
    });
  });

  describe("GET /accounts/:id/sessions/active", () => {
    it("403 for a user without the permission", async () => {
      await api().get(`/api/v1/accounts/${UUID}/sessions/active`).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted view-account-sessions and forwards the id", async () => {
      h.cpg.grantGlobal("accounts", "access", "view-account-sessions");
      jwtAuth.listActiveSessions.mockResolvedValueOnce([]);
      await api().get(`/api/v1/accounts/${UUID}/sessions/active`).set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
      expect(jwtAuth.listActiveSessions).toHaveBeenCalledWith(UUID);
    });

    it("400 when :id is not a uuid", async () => {
      await api().get("/api/v1/accounts/not-a-uuid/sessions/active").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });

  describe("GET /accounts/:id/sessions/history", () => {
    it("403 for a user without the permission", async () => {
      await api().get(`/api/v1/accounts/${UUID}/sessions/history`).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for root and forwards the validated pagination query", async () => {
      jwtAuth.listSessionHistory.mockResolvedValueOnce({ items: [], total: 0 });
      await api().get(`/api/v1/accounts/${UUID}/sessions/history?limit=10`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(jwtAuth.listSessionHistory).toHaveBeenCalledWith(UUID, expect.objectContaining({ limit: 10, offset: 0 }));
    });

    it("400 on an invalid pagination query (zod)", async () => {
      await api().get(`/api/v1/accounts/${UUID}/sessions/history?limit=7`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });

    it("400 when :id is not a uuid", async () => {
      await api().get("/api/v1/accounts/not-a-uuid/sessions/history").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });

  describe("DELETE /accounts/:id/sessions/:sessionId", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .delete(`/api/v1/accounts/${UUID}/sessions/${SESSION_ID}`)
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .expect(403);
    });

    it("200 for a user granted revoke-account-sessions and forwards id + sessionId", async () => {
      h.cpg.grantGlobal("accounts", "access", "revoke-account-sessions");
      jwtAuth.revokeSession.mockResolvedValueOnce({ ok: true });
      await api()
        .delete(`/api/v1/accounts/${UUID}/sessions/${SESSION_ID}`)
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .expect(200);
      expect(jwtAuth.revokeSession).toHaveBeenCalledWith(UUID, SESSION_ID);
    });

    it("400 when :sessionId is not an integer", async () => {
      await api().delete(`/api/v1/accounts/${UUID}/sessions/abc`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });

  describe("DELETE /accounts/:id/sessions/history", () => {
    it("403 for a user without the permission", async () => {
      await api().delete(`/api/v1/accounts/${UUID}/sessions/history`).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("403 for a user with only revoke (purge is a distinct action)", async () => {
      h.cpg.grantGlobal("accounts", "access", "revoke-account-sessions");
      await api().delete(`/api/v1/accounts/${UUID}/sessions/history`).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted purge-account-sessions and forwards the id", async () => {
      h.cpg.grantGlobal("accounts", "access", "purge-account-sessions");
      jwtAuth.purgeAccountSessionHistory.mockResolvedValueOnce({ ok: true, purged: 42 });
      await api().delete(`/api/v1/accounts/${UUID}/sessions/history`).set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
      expect(jwtAuth.purgeAccountSessionHistory).toHaveBeenCalledWith(UUID);
    });

    it("400 when :id is not a uuid", async () => {
      await api().delete("/api/v1/accounts/not-a-uuid/sessions/history").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });

  describe("DELETE /accounts/:id/sessions", () => {
    it("403 for a user without the permission", async () => {
      await api().delete(`/api/v1/accounts/${UUID}/sessions`).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted revoke-account-sessions and forwards the id", async () => {
      h.cpg.grantGlobal("accounts", "access", "revoke-account-sessions");
      jwtAuth.revokeAllActiveSessions.mockResolvedValueOnce({ ok: true, revoked: 3 });
      await api().delete(`/api/v1/accounts/${UUID}/sessions`).set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
      expect(jwtAuth.revokeAllActiveSessions).toHaveBeenCalledWith(UUID);
    });

    it("400 when :id is not a uuid", async () => {
      await api().delete("/api/v1/accounts/not-a-uuid/sessions").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });
});
