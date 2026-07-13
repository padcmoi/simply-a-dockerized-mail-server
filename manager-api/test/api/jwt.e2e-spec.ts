import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtAuthController } from "../../src/core/auth/jwt/jwt.controller";
import { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// login / refresh / logout are @Public (no token needed). me + me/* are
// authenticated but carry NO permission requirement: 401 without a token, 2xx
// with any valid token. The controller reads its effective-permission + group
// data off cpg.guard, so those methods are grafted onto the harness cpg mock,
// and a VirtualDomain repo double (findBy) backs withDomainNames().
describe("JwtAuthController (e2e: public + authenticated, no ACL)", () => {
  let h: Harness;

  const auth = {
    login: vi.fn(),
    refresh: vi.fn(),
    revoke: vi.fn(),
    me: vi.fn(),
    updateProfile: vi.fn(),
    listSessions: vi.fn(),
    revokeSession: vi.fn(),
  };
  const getEffectivePermissions = vi.fn();
  const findGroupMemberIds = vi.fn();
  const findGroupGlobalPermissions = vi.fn();
  const findGroupDomainPermissions = vi.fn();
  const domainRepo = { findBy: vi.fn(), find: vi.fn() };
  const virtualUserRepo = { find: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [JwtAuthController],
      providers: [
        { provide: JwtAuthService, useValue: auth },
        { provide: getRepositoryToken(VirtualDomain), useValue: domainRepo },
        { provide: getRepositoryToken(VirtualUser), useValue: virtualUserRepo },
      ],
    });
    Object.assign(h.cpg.guard, {
      getEffectivePermissions,
      findGroupMemberIds,
      findGroupGlobalPermissions,
      findGroupDomainPermissions,
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const GROUP_ID = "11111111-1111-1111-1111-111111111111";

  describe("POST login (public)", () => {
    it("200 with no Authorization header and forwards credentials", async () => {
      auth.login.mockResolvedValueOnce({ accessToken: "a", refreshToken: "r", expiresAt: "2030-01-01T00:00:00.000Z" });
      const res = await api()
        .post("/api/v1/auth/jwt/login")
        .send({ email: "user@test.local", password: "s3cret" })
        .expect(200);
      expect(res.body.accessToken).toBe("a");
      // ua (user-agent header) may be undefined and ip is socket-derived, so
      // only the credentials are asserted precisely.
      const [email, password] = auth.login.mock.calls[0];
      expect([email, password]).toEqual(["user@test.local", "s3cret"]);
    });
    it("400 on an invalid email (zod)", async () => {
      await api().post("/api/v1/auth/jwt/login").send({ email: "nope", password: "x" }).expect(400);
    });
    it("400 on a missing password (zod)", async () => {
      await api().post("/api/v1/auth/jwt/login").send({ email: "user@test.local" }).expect(400);
    });
  });

  describe("POST refresh (public)", () => {
    it("200 and forwards the refresh token", async () => {
      auth.refresh.mockResolvedValueOnce({ accessToken: "a2", refreshToken: "r2", expiresAt: "2030-01-01T00:00:00.000Z" });
      await api().post("/api/v1/auth/jwt/refresh").send({ refreshToken: "abcdefgh" }).expect(200);
      expect(auth.refresh.mock.calls[0][0]).toBe("abcdefgh");
    });
    it("400 when the refresh token is too short (zod)", async () => {
      await api().post("/api/v1/auth/jwt/refresh").send({ refreshToken: "short" }).expect(400);
    });
  });

  describe("POST logout (public)", () => {
    it("200, returns { ok: true } and revokes the token", async () => {
      auth.revoke.mockResolvedValueOnce(undefined);
      const res = await api().post("/api/v1/auth/jwt/logout").send({ refreshToken: "abcdefgh" }).expect(200);
      expect(res.body).toEqual({ ok: true });
      expect(auth.revoke).toHaveBeenCalledWith("abcdefgh");
    });
    it("400 on an invalid body (zod)", async () => {
      await api().post("/api/v1/auth/jwt/logout").send({ refreshToken: "no" }).expect(400);
    });
  });

  describe("GET me (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/auth/jwt/me").expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get("/api/v1/auth/jwt/me").set("Authorization", "Bearer nope").expect(401);
    });
    it("200 with a valid token (no grant needed) and forwards the caller id", async () => {
      auth.me.mockResolvedValueOnce({ email: "user@test.local", isRoot: false });
      const res = await api().get("/api/v1/auth/jwt/me").set(bearer(h.token(USER))).expect(200);
      expect(res.body.email).toBe("user@test.local");
      expect(auth.me).toHaveBeenCalledWith(USER.id);
    });
  });

  describe("GET me/overview (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/auth/jwt/me/overview").expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get("/api/v1/auth/jwt/me/overview").set("Authorization", "Bearer nope").expect(401);
    });
    it("200 with a token: returns the caller's owned domains and recipients", async () => {
      domainRepo.find.mockResolvedValueOnce([{ id: 5, domain: "ex.com", active: 1, quota: "0" }]);
      virtualUserRepo.find.mockResolvedValueOnce([{ id: 9, email: "j@ex.com", domain: "ex.com", active: 0, quota: "100" }]);
      const res = await api().get("/api/v1/auth/jwt/me/overview").set(bearer(h.token(USER))).expect(200);
      expect(domainRepo.find).toHaveBeenCalledWith({ where: { ownerId: USER.id }, order: { domain: "ASC" } });
      expect(virtualUserRepo.find).toHaveBeenCalledWith({ where: { ownerId: USER.id }, order: { email: "ASC" } });
      expect(res.body.domains).toEqual([{ id: 5, domain: "ex.com", active: true, quota: "0" }]);
      expect(res.body.recipients).toEqual([{ id: 9, email: "j@ex.com", domain: "ex.com", active: false, quota: "100" }]);
    });
  });

  describe("GET me/sessions (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/auth/jwt/me/sessions").expect(401);
    });
    it("200 with a token and forwards the caller id", async () => {
      auth.listSessions.mockResolvedValueOnce([{ id: 1, userAgent: "UA", ip: "1.2.3.4", active: true }]);
      const res = await api().get("/api/v1/auth/jwt/me/sessions").set(bearer(h.token(USER))).expect(200);
      expect(res.body).toHaveLength(1);
      expect(auth.listSessions).toHaveBeenCalledWith(USER.id);
    });
  });

  describe("DELETE me/sessions/:id (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().delete("/api/v1/auth/jwt/me/sessions/7").expect(401);
    });
    it("200 with a token and forwards (callerId, id)", async () => {
      auth.revokeSession.mockResolvedValueOnce({ ok: true });
      await api().delete("/api/v1/auth/jwt/me/sessions/7").set(bearer(h.token(USER))).expect(200);
      expect(auth.revokeSession).toHaveBeenCalledWith(USER.id, 7);
    });
    it("400 when :id is not an integer", async () => {
      await api().delete("/api/v1/auth/jwt/me/sessions/nope").set(bearer(h.token(USER))).expect(400);
    });
  });

  describe("PATCH me (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().patch("/api/v1/auth/jwt/me").send({ displayName: "Bob" }).expect(401);
    });
    it("200 with a token and forwards (callerId, body)", async () => {
      auth.updateProfile.mockResolvedValueOnce({ email: "user@test.local", displayName: "Bob" });
      await api().patch("/api/v1/auth/jwt/me").set(bearer(h.token(USER))).send({ displayName: "Bob" }).expect(200);
      expect(auth.updateProfile).toHaveBeenCalledWith(USER.id, { displayName: "Bob" });
    });
    it("400 on an invalid email (zod)", async () => {
      await api().patch("/api/v1/auth/jwt/me").set(bearer(h.token(USER))).send({ email: "nope" }).expect(400);
    });
  });

  describe("GET me/permissions (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/auth/jwt/me/permissions").expect(401);
    });
    it("200 and resolves each domain permission to its FQDN", async () => {
      getEffectivePermissions.mockResolvedValueOnce({
        global: [{ resource: "domains", action: "access" }],
        domain: [{ domainId: 1, resource: "recipients", action: "access" }],
      });
      domainRepo.findBy.mockResolvedValueOnce([{ id: 1, domain: "one.test" }]);
      const res = await api().get("/api/v1/auth/jwt/me/permissions").set(bearer(h.token(USER))).expect(200);
      expect(getEffectivePermissions).toHaveBeenCalledWith(USER.id);
      expect(res.body.global).toEqual([{ resource: "domains", action: "access" }]);
      expect(res.body.domain[0].domainName).toBe("one.test");
    });
    it("falls back to #<id> for a since-deleted domain", async () => {
      getEffectivePermissions.mockResolvedValueOnce({ global: [], domain: [{ domainId: 42, resource: "domain", action: "access" }] });
      domainRepo.findBy.mockResolvedValueOnce([]);
      const res = await api().get("/api/v1/auth/jwt/me/permissions").set(bearer(h.token(USER))).expect(200);
      expect(res.body.domain[0].domainName).toBe("#42");
    });
  });

  describe("GET me/groups/:id/permissions (authenticated, membership-gated)", () => {
    it("401 without a token", async () => {
      await api().get(`/api/v1/auth/jwt/me/groups/${GROUP_ID}/permissions`).expect(401);
    });
    it("400 when :id is not a UUID", async () => {
      await api().get("/api/v1/auth/jwt/me/groups/not-a-uuid/permissions").set(bearer(h.token(ROOT))).expect(400);
    });
    it("200 for root without a membership check", async () => {
      findGroupGlobalPermissions.mockResolvedValueOnce([{ resource: "domains", action: "access" }]);
      findGroupDomainPermissions.mockResolvedValueOnce([]);
      const res = await api().get(`/api/v1/auth/jwt/me/groups/${GROUP_ID}/permissions`).set(bearer(h.token(ROOT))).expect(200);
      expect(findGroupMemberIds).not.toHaveBeenCalled();
      expect(res.body.globalPermissions).toEqual([{ resource: "domains", action: "access" }]);
    });
    it("403 for a non-member user", async () => {
      findGroupMemberIds.mockResolvedValueOnce(["someone-else"]);
      await api().get(`/api/v1/auth/jwt/me/groups/${GROUP_ID}/permissions`).set(bearer(h.token(USER))).expect(403);
    });
    it("200 for a member user and resolves domain FQDNs", async () => {
      findGroupMemberIds.mockResolvedValueOnce([USER.id]);
      findGroupGlobalPermissions.mockResolvedValueOnce([]);
      findGroupDomainPermissions.mockResolvedValueOnce([{ domainId: 2, action: "access" }]);
      domainRepo.findBy.mockResolvedValueOnce([{ id: 2, domain: "two.test" }]);
      const res = await api().get(`/api/v1/auth/jwt/me/groups/${GROUP_ID}/permissions`).set(bearer(h.token(USER))).expect(200);
      expect(res.body.domainPermissions[0].domainName).toBe("two.test");
    });
  });
});
