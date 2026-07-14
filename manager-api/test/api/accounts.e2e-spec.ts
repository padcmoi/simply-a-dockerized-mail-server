import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AccountsController } from "../../src/api/accounts/accounts.controller";
import { AccountsService } from "../../src/api/accounts/accounts.service";
import { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// A well-formed uuid so ParseUUIDPipe passes and only the guard / body pipe can
// reject; a deliberately malformed one is used for the 400 assertions.
const UUID = "11111111-1111-1111-1111-111111111111";
const SESSION_ID = 42;

describe("AccountsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    listNames: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    getOverview: vi.fn(),
    updateAccount: vi.fn(),
    revokeAccount: vi.fn(),
    sendInvitation: vi.fn(),
    getInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
  };
  // The session routes delegate to JwtAuthService (reused for the admin views).
  const jwtAuth = {
    listSessionsOverview: vi.fn(),
    listActiveSessions: vi.fn(),
    listSessionHistory: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllActiveSessions: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: svc },
        { provide: JwtAuthService, useValue: jwtAuth },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const call = (method: string, path: string) => (api() as unknown as Record<string, (p: string) => request.Test>)[method](path);

  // Every guarded route, exercised for the two auth failures in one sweep.
  const PROTECTED: Array<[string, string]> = [
    ["get", "/api/v1/accounts/names"],
    ["get", "/api/v1/accounts"],
    ["get", `/api/v1/accounts/${UUID}`],
    ["get", `/api/v1/accounts/${UUID}/overview`],
    ["patch", `/api/v1/accounts/${UUID}/edit`],
    ["delete", `/api/v1/accounts/${UUID}`],
    ["post", "/api/v1/accounts/invite"],
    ["get", "/api/v1/accounts/sessions/overview"],
    ["get", `/api/v1/accounts/${UUID}/sessions/active`],
    ["get", `/api/v1/accounts/${UUID}/sessions/history`],
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

  describe("GET /accounts/names", () => {
    it("403 for a user without the permission", async () => {
      await api().get("/api/v1/accounts/names").set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("accounts", "access", "list-account-names");
      svc.listNames.mockResolvedValueOnce([]);
      await api().get("/api/v1/accounts/names").set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
    });

    it("200 for root and forwards the parsed typeahead args", async () => {
      svc.listNames.mockResolvedValueOnce([{ id: "1", email: "a@b.com", displayName: null }]);
      await api()
        .get("/api/v1/accounts/names?limit=5&search=%20bob%20&notInGroup=g-1")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .expect(200);
      expect(svc.listNames).toHaveBeenCalledWith({ notInGroup: "g-1", search: "bob", limit: 5 });
    });

    it("passes undefined for absent limit/search (legacy full list)", async () => {
      svc.listNames.mockResolvedValueOnce([]);
      await api().get("/api/v1/accounts/names").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.listNames).toHaveBeenCalledWith({ notInGroup: undefined, search: undefined, limit: undefined });
    });

    it("clamps limit to <= 50", async () => {
      svc.listNames.mockResolvedValueOnce([]);
      await api().get("/api/v1/accounts/names?limit=999").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.listNames.mock.calls.at(-1)![0]).toMatchObject({ limit: 50 });
    });

    it("clamps limit to >= 1 for a negative value", async () => {
      svc.listNames.mockResolvedValueOnce([]);
      await api().get("/api/v1/accounts/names?limit=-5").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.listNames.mock.calls.at(-1)![0]).toMatchObject({ limit: 1 });
    });

    it("falls back to 25 on an unparseable limit and drops a blank search", async () => {
      svc.listNames.mockResolvedValueOnce([]);
      await api().get("/api/v1/accounts/names?limit=abc&search=%20%20").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.listNames.mock.calls.at(-1)![0]).toEqual({ notInGroup: undefined, search: undefined, limit: 25 });
    });
  });

  describe("GET /accounts", () => {
    it("403 for a user without the permission", async () => {
      await api().get("/api/v1/accounts").set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("accounts", "access", "list-accounts");
      svc.list.mockResolvedValueOnce({ items: [], total: 0 });
      await api().get("/api/v1/accounts").set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
    });

    it("200 for root and forwards the validated pagination query", async () => {
      svc.list.mockResolvedValueOnce({ items: [], total: 0 });
      await api().get("/api/v1/accounts?limit=10").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 0, sortDir: "desc" }));
    });

    it("400 on an invalid pagination query (zod)", async () => {
      await api().get("/api/v1/accounts?limit=7").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });

  describe("GET /accounts/:id", () => {
    it("403 for a user without the permission", async () => {
      await api().get(`/api/v1/accounts/${UUID}`).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("accounts", "access", "view-account");
      svc.getById.mockResolvedValueOnce({ id: UUID });
      await api().get(`/api/v1/accounts/${UUID}`).set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
    });

    it("200 for root and forwards the id", async () => {
      svc.getById.mockResolvedValueOnce({ id: UUID });
      await api().get(`/api/v1/accounts/${UUID}`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.getById).toHaveBeenCalledWith(UUID);
    });

    it("400 when :id is not a uuid", async () => {
      await api().get("/api/v1/accounts/not-a-uuid").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });

  describe("GET /accounts/:id/overview", () => {
    it("403 for a user without the permission", async () => {
      await api().get(`/api/v1/accounts/${UUID}/overview`).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("accounts", "access", "view-account");
      svc.getOverview.mockResolvedValueOnce({ account: { id: UUID }, domains: [], recipients: [] });
      await api().get(`/api/v1/accounts/${UUID}/overview`).set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
    });

    it("200 for root and forwards the id", async () => {
      svc.getOverview.mockResolvedValueOnce({ account: { id: UUID }, domains: [], recipients: [] });
      await api().get(`/api/v1/accounts/${UUID}/overview`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.getOverview).toHaveBeenCalledWith(UUID);
    });

    it("400 when :id is not a uuid", async () => {
      await api().get("/api/v1/accounts/not-a-uuid/overview").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });

  describe("PATCH /accounts/:id/edit", () => {
    it("403 for a user without the permission", async () => {
      await api().patch(`/api/v1/accounts/${UUID}/edit`).set("Authorization", `Bearer ${h.token(USER)}`).send({ enabled: true }).expect(403);
    });

    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("accounts", "access", "edit-account");
      svc.updateAccount.mockResolvedValueOnce({ id: UUID });
      await api()
        .patch(`/api/v1/accounts/${UUID}/edit`)
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .send({ enabled: false })
        .expect(200);
    });

    it("200 for root and forwards id + the full profile body", async () => {
      svc.updateAccount.mockResolvedValueOnce({ id: UUID });
      const body = {
        email: "new@x.com",
        displayName: "New",
        avatarUrl: "https://example.com/a.png",
        phone: "+33123456789",
        addressLine: "10 rue de la Paix",
        addressComplement: "Apt 4B",
        city: "Paris",
        postalCode: "75002",
        country: "France",
        enabled: true,
      };
      await api()
        .patch(`/api/v1/accounts/${UUID}/edit`)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send(body)
        .expect(200);
      expect(svc.updateAccount).toHaveBeenCalledWith(UUID, body);
    });

    it("400 when :id is not a uuid", async () => {
      await api().patch("/api/v1/accounts/nope/edit").set("Authorization", `Bearer ${h.token(ROOT)}`).send({ enabled: true }).expect(400);
    });

    it("400 on an invalid body (zod)", async () => {
      await api()
        .patch(`/api/v1/accounts/${UUID}/edit`)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ email: "not-an-email" })
        .expect(400);
    });

    it("400 on an invalid profile field (zod: avatarUrl not a url)", async () => {
      await api()
        .patch(`/api/v1/accounts/${UUID}/edit`)
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ avatarUrl: "not-a-url" })
        .expect(400);
    });
  });

  describe("DELETE /accounts/:id", () => {
    it("403 for a user without the permission", async () => {
      await api().delete(`/api/v1/accounts/${UUID}`).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    });

    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("accounts", "access", "revoke-account");
      svc.revokeAccount.mockResolvedValueOnce({ ok: true });
      await api().delete(`/api/v1/accounts/${UUID}`).set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
    });

    it("200 for root and forwards the id", async () => {
      svc.revokeAccount.mockResolvedValueOnce({ ok: true });
      await api().delete(`/api/v1/accounts/${UUID}`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
      expect(svc.revokeAccount).toHaveBeenCalledWith(UUID);
    });

    it("400 when :id is not a uuid", async () => {
      await api().delete("/api/v1/accounts/nope").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
    });
  });

  describe("POST /accounts/invite", () => {
    it("403 for a user without the permission", async () => {
      await api()
        .post("/api/v1/accounts/invite")
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .send({ email: "new@user.com" })
        .expect(403);
    });

    it("201 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("accounts", "access", "invite-account");
      svc.sendInvitation.mockResolvedValueOnce({ ok: true });
      await api()
        .post("/api/v1/accounts/invite")
        .set("Authorization", `Bearer ${h.token(USER)}`)
        .send({ email: "new@user.com" })
        .expect(201);
    });

    it("201 for root and forwards the acting user + validated body", async () => {
      svc.sendInvitation.mockResolvedValueOnce({ ok: true });
      await api()
        .post("/api/v1/accounts/invite")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ email: "new@user.com" })
        .expect(201);
      expect(svc.sendInvitation).toHaveBeenCalledWith(
        { id: ROOT.id, email: ROOT.email, isRoot: true },
        { email: "new@user.com", groupId: null }
      );
    });

    it("400 on an invalid body (zod)", async () => {
      await api()
        .post("/api/v1/accounts/invite")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ email: "not-an-email" })
        .expect(400);
    });
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

  // The two invitation routes are @Public(): no Authorization header, no ACL.
  describe("GET /accounts/invite/:token (public)", () => {
    it("200 with no Authorization header and forwards the token", async () => {
      svc.getInvitation.mockResolvedValueOnce({ email: "x@y.com", groupName: null, expiresAt: new Date() });
      await api().get("/api/v1/accounts/invite/tok-123").expect(200);
      expect(svc.getInvitation).toHaveBeenCalledWith("tok-123");
    });
  });

  describe("POST /accounts/invite/:token/accept (public)", () => {
    it("201 with no Authorization header and forwards token + body", async () => {
      svc.acceptInvitation.mockResolvedValueOnce({ ok: true, email: "x@y.com" });
      await api().post("/api/v1/accounts/invite/tok-123/accept").send({ password: "longenough", displayName: "Jo" }).expect(201);
      expect(svc.acceptInvitation).toHaveBeenCalledWith("tok-123", { password: "longenough", displayName: "Jo" });
    });

    it("400 on an invalid body (zod: password too short)", async () => {
      await api().post("/api/v1/accounts/invite/tok-123/accept").send({ password: "short" }).expect(400);
    });
  });
});
