import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtAuthController } from "../../src/core/auth/jwt/jwt.controller";
import { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import { LocalProvider } from "../../src/core/auth/passport/providers/local.provider";
import { Account } from "../../src/core/entities/account.entity";
import { VirtualAlias } from "../../src/core/entities/virtual-alias.entity";
import { VirtualQuotaUser } from "../../src/core/entities/virtual-quota-user.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";
import { ACTIVITY_ACTIONS, ActivityLogService } from "../../src/core/activity/activity-log.service";

// The login route verifies credentials through the real `local` provider, so it
// is registered here with an account repo double. Only the hashing is stubbed:
// this suite is about which routes are reachable, not about scrypt.
const { verify } = vi.hoisted(() => ({ verify: vi.fn<(plain: string, stored: string) => Promise<boolean>>() }));
vi.mock("../../src/core/common/scrypt", () => ({ scryptVerify: verify }));

// login / refresh / logout are @Public (no token needed). me + me/* are
// authenticated but carry NO permission requirement: 401 without a token, 2xx
// with any valid token. The controller reads its effective-permission + group
// data off cpg.guard, so those methods are grafted onto the harness cpg mock,
// and a VirtualDomain repo double (findBy) backs withDomainNames().
describe("JwtAuthController (e2e: public + authenticated, no ACL)", () => {
  let h: Harness;

  const auth = {
    openSessionFor: vi.fn(),
    completeTwoFactor: vi.fn(),
    changePassword: vi.fn(),
    refresh: vi.fn(),
    revoke: vi.fn(),
    me: vi.fn(),
    updateProfile: vi.fn(),
    listActiveSessions: vi.fn(),
    listSessionHistory: vi.fn(),
    revokeSession: vi.fn(),
  };
  const getEffectivePermissions = vi.fn();
  const findGroupMemberIds = vi.fn();
  const findGroupGlobalPermissions = vi.fn();
  const findGroupDomainPermissions = vi.fn();
  const domainRepo = { findBy: vi.fn(), find: vi.fn() };
  const virtualUserRepo = { find: vi.fn() };
  const virtualAliasRepo = { find: vi.fn() };
  const recipientQuotaRepo = { find: vi.fn().mockResolvedValue([]) };
  const accountRepo = { findOne: vi.fn() };
  const activity = { record: vi.fn(async () => undefined), listForAccount: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [JwtAuthController],
      providers: [
        { provide: JwtAuthService, useValue: auth },
        { provide: ActivityLogService, useValue: activity },
        LocalProvider,
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(VirtualDomain), useValue: domainRepo },
        { provide: getRepositoryToken(VirtualUser), useValue: virtualUserRepo },
        { provide: getRepositoryToken(VirtualAlias), useValue: virtualAliasRepo },
        { provide: getRepositoryToken(VirtualQuotaUser), useValue: recipientQuotaRepo },
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
    it("200 with no Authorization header, on the account the credentials matched", async () => {
      const account = { id: "a1", email: "user@test.local", password: "hash", enabled: 1 };
      accountRepo.findOne.mockResolvedValueOnce(account);
      verify.mockResolvedValueOnce(true);
      auth.openSessionFor.mockResolvedValueOnce({ accessToken: "a", refreshToken: "r", expiresAt: "2030-01-01T00:00:00.000Z" });
      const res = await api().post("/api/v1/auth/jwt/login").send({ email: "user@test.local", password: "s3cret" }).expect(200);
      expect(res.body.accessToken).toBe("a");
      expect(accountRepo.findOne).toHaveBeenCalledWith({ where: { email: "user@test.local", enabled: 1 } });
      expect(verify).toHaveBeenCalledWith("s3cret", "hash");
      // ua (user-agent header) may be undefined and ip is socket-derived, so
      // only the account is asserted precisely.
      expect(auth.openSessionFor.mock.calls[0][0]).toBe(account);
    });

    it("401 when the credentials do not match", async () => {
      accountRepo.findOne.mockResolvedValueOnce({ id: "a1", email: "user@test.local", password: "hash", enabled: 1 });
      verify.mockResolvedValueOnce(false);
      await api().post("/api/v1/auth/jwt/login").send({ email: "user@test.local", password: "nope" }).expect(401);
      expect(auth.openSessionFor).not.toHaveBeenCalled();
    });
    it("400 on an invalid email (zod)", async () => {
      await api().post("/api/v1/auth/jwt/login").send({ email: "nope", password: "x" }).expect(400);
    });
    it("400 on a missing password (zod)", async () => {
      await api().post("/api/v1/auth/jwt/login").send({ email: "user@test.local" }).expect(400);
    });
  });

  describe("POST login/two-factor (public)", () => {
    const CHALLENGE = "c".repeat(43);
    it("200 with no Authorization header and forwards (challenge, code)", async () => {
      auth.completeTwoFactor.mockResolvedValueOnce({
        accessToken: "a",
        refreshToken: "r",
        expiresAt: "2030-01-01T00:00:00.000Z",
      });
      const res = await api()
        .post("/api/v1/auth/jwt/login/two-factor")
        .send({ challenge: CHALLENGE, code: "123456" })
        .expect(200);
      expect(res.body.accessToken).toBe("a");
      expect(auth.completeTwoFactor.mock.calls[0].slice(0, 2)).toEqual([CHALLENGE, "123456"]);
    });
    it("400 on a challenge that is too short (zod)", async () => {
      await api().post("/api/v1/auth/jwt/login/two-factor").send({ challenge: "short", code: "123456" }).expect(400);
      expect(auth.completeTwoFactor).not.toHaveBeenCalled();
    });
    it("400 on a code that is too short (zod)", async () => {
      await api().post("/api/v1/auth/jwt/login/two-factor").send({ challenge: CHALLENGE, code: "12" }).expect(400);
    });
    it("400 on an unknown field (zod strict)", async () => {
      await api().post("/api/v1/auth/jwt/login/two-factor").send({ challenge: CHALLENGE, code: "123456", x: 1 }).expect(400);
    });
  });

  describe("PATCH me/password (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().patch("/api/v1/auth/jwt/me/password").send({ currentPassword: "old", newPassword: "newpassword" }).expect(401);
    });
    it("200 with a token and forwards (callerId, body)", async () => {
      auth.changePassword.mockResolvedValueOnce({ changed: true });
      const res = await api()
        .patch("/api/v1/auth/jwt/me/password")
        .set(bearer(h.token(USER)))
        .send({ currentPassword: "old", newPassword: "newpassword" })
        .expect(200);
      expect(res.body).toEqual({ changed: true });
      expect(auth.changePassword).toHaveBeenCalledWith(USER.id, { currentPassword: "old", newPassword: "newpassword" });
    });
    it("400 on a missing new password (zod)", async () => {
      await api()
        .patch("/api/v1/auth/jwt/me/password")
        .set(bearer(h.token(USER)))
        .send({ currentPassword: "old" })
        .expect(400);
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
      const res = await api()
        .get("/api/v1/auth/jwt/me")
        .set(bearer(h.token(USER)))
        .expect(200);
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
    it("200 with a token: returns the caller's owned domains, recipients and aliases", async () => {
      domainRepo.find.mockResolvedValueOnce([{ id: 5, domain: "ex.com", active: 1, quota: "0" }]);
      virtualUserRepo.find.mockResolvedValueOnce([{ id: 9, email: "j@ex.com", domain: "ex.com", active: 0, quota: "100" }]);
      virtualAliasRepo.find.mockResolvedValueOnce([{ id: 3, source: "c@ex.com", destination: "j@ex.com", domain: "ex.com" }]);
      recipientQuotaRepo.find.mockResolvedValueOnce([{ email: "j@ex.com", bytes: "42" }]);
      const res = await api()
        .get("/api/v1/auth/jwt/me/overview")
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(domainRepo.find).toHaveBeenCalledWith({ where: { ownerId: USER.id }, order: { domain: "ASC" } });
      expect(virtualUserRepo.find).toHaveBeenCalledWith({ where: { ownerId: USER.id }, order: { email: "ASC" } });
      expect(virtualAliasRepo.find).toHaveBeenCalledWith({ where: { ownerId: USER.id }, order: { source: "ASC" } });
      expect(res.body.domains).toEqual([{ id: 5, domain: "ex.com", active: true, quota: "0" }]);
      expect(res.body.recipients).toEqual([
        { id: 9, email: "j@ex.com", domain: "ex.com", active: false, quota: "100", usedBytes: "42" },
      ]);
      expect(res.body.aliases).toEqual([{ id: 3, source: "c@ex.com", destination: "j@ex.com", domain: "ex.com" }]);
    });
  });

  describe("GET me/sessions (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/auth/jwt/me/sessions").expect(401);
    });
    it("200 with a token and forwards the caller id", async () => {
      auth.listActiveSessions.mockResolvedValueOnce([{ id: 1, userAgent: "UA", ip: "1.2.3.4", active: true }]);
      const res = await api()
        .get("/api/v1/auth/jwt/me/sessions")
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(auth.listActiveSessions).toHaveBeenCalledWith(USER.id);
    });
  });

  describe("GET me/sessions/history (authenticated, no ACL, paginated)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/auth/jwt/me/sessions/history").expect(401);
    });
    it("200 with a token and forwards (callerId, parsed pagination query)", async () => {
      auth.listSessionHistory.mockResolvedValueOnce({ items: [{ id: 2, active: false }], total: 1 });
      const res = await api()
        .get("/api/v1/auth/jwt/me/sessions/history?limit=10&offset=0&search=chrome&sortBy=createdAt&sortDir=asc")
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(res.body).toEqual({ items: [{ id: 2, active: false }], total: 1 });
      expect(auth.listSessionHistory).toHaveBeenCalledWith(
        USER.id,
        expect.objectContaining({ limit: 10, offset: 0, search: "chrome", sortBy: "createdAt", sortDir: "asc" })
      );
    });
    it("400 when limit is not 10/25/50 (zod)", async () => {
      await api()
        .get("/api/v1/auth/jwt/me/sessions/history?limit=7")
        .set(bearer(h.token(USER)))
        .expect(400);
    });
  });

  describe("GET me/activity (authenticated, no ACL, paginated)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/auth/jwt/me/activity").expect(401);
    });
    it("200 with a token and forwards (callerId, parsed query with its action filter)", async () => {
      activity.listForAccount.mockResolvedValueOnce({ items: [{ id: 1, action: "auth.login" }], total: 1 });
      const res = await api()
        .get("/api/v1/auth/jwt/me/activity?limit=10&offset=0&action=auth.login")
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(res.body).toEqual({ items: [{ id: 1, action: "auth.login" }], total: 1 });
      expect(activity.listForAccount).toHaveBeenCalledWith(
        USER.id,
        expect.objectContaining({ limit: 10, offset: 0, action: "auth.login" })
      );
    });
    it("400 when limit is not 10/25/50 (zod)", async () => {
      await api()
        .get("/api/v1/auth/jwt/me/activity?limit=7")
        .set(bearer(h.token(USER)))
        .expect(400);
    });
  });

  describe("GET me/activity/actions (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/auth/jwt/me/activity/actions").expect(401);
    });
    it("200 with a token and lists every kind of event", async () => {
      const res = await api()
        .get("/api/v1/auth/jwt/me/activity/actions")
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(res.body).toEqual(ACTIVITY_ACTIONS);
      expect(res.body).toContain("auth.login");
    });
  });

  describe("DELETE me/sessions/:id (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().delete("/api/v1/auth/jwt/me/sessions/7").expect(401);
    });
    it("200 with a token and forwards (callerId, id)", async () => {
      auth.revokeSession.mockResolvedValueOnce({ ok: true });
      await api()
        .delete("/api/v1/auth/jwt/me/sessions/7")
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(auth.revokeSession).toHaveBeenCalledWith(USER.id, 7);
    });
    it("400 when :id is not an integer", async () => {
      await api()
        .delete("/api/v1/auth/jwt/me/sessions/nope")
        .set(bearer(h.token(USER)))
        .expect(400);
    });
  });

  describe("PATCH me (authenticated, no ACL)", () => {
    it("401 without a token", async () => {
      await api().patch("/api/v1/auth/jwt/me").send({ lastName: "Bob" }).expect(401);
    });
    it("200 with a token and forwards (callerId, body)", async () => {
      auth.updateProfile.mockResolvedValueOnce({ email: "user@test.local", displayName: "Bob Martin" });
      await api()
        .patch("/api/v1/auth/jwt/me")
        .set(bearer(h.token(USER)))
        .send({ lastName: "Bob" })
        .expect(200);
      expect(auth.updateProfile).toHaveBeenCalledWith(USER.id, { lastName: "Bob" });
    });
    it("400 on an invalid email (zod)", async () => {
      await api()
        .patch("/api/v1/auth/jwt/me")
        .set(bearer(h.token(USER)))
        .send({ email: "nope" })
        .expect(400);
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
      const res = await api()
        .get("/api/v1/auth/jwt/me/permissions")
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(getEffectivePermissions).toHaveBeenCalledWith(USER.id);
      expect(res.body.global).toEqual([{ resource: "domains", action: "access" }]);
      expect(res.body.domain[0].domainName).toBe("one.test");
    });
    it("falls back to #<id> for a since-deleted domain", async () => {
      getEffectivePermissions.mockResolvedValueOnce({
        global: [],
        domain: [{ domainId: 42, resource: "domain", action: "access" }],
      });
      domainRepo.findBy.mockResolvedValueOnce([]);
      const res = await api()
        .get("/api/v1/auth/jwt/me/permissions")
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(res.body.domain[0].domainName).toBe("#42");
    });
  });

  describe("GET me/groups/:id/permissions (authenticated, membership-gated)", () => {
    it("401 without a token", async () => {
      await api().get(`/api/v1/auth/jwt/me/groups/${GROUP_ID}/permissions`).expect(401);
    });
    it("400 when :id is not a UUID", async () => {
      await api()
        .get("/api/v1/auth/jwt/me/groups/not-a-uuid/permissions")
        .set(bearer(h.token(ROOT)))
        .expect(400);
    });
    it("200 for root without a membership check", async () => {
      findGroupGlobalPermissions.mockResolvedValueOnce([{ resource: "domains", action: "access" }]);
      findGroupDomainPermissions.mockResolvedValueOnce([]);
      const res = await api()
        .get(`/api/v1/auth/jwt/me/groups/${GROUP_ID}/permissions`)
        .set(bearer(h.token(ROOT)))
        .expect(200);
      expect(findGroupMemberIds).not.toHaveBeenCalled();
      expect(res.body.globalPermissions).toEqual([{ resource: "domains", action: "access" }]);
    });
    it("403 for a non-member user", async () => {
      findGroupMemberIds.mockResolvedValueOnce(["someone-else"]);
      await api()
        .get(`/api/v1/auth/jwt/me/groups/${GROUP_ID}/permissions`)
        .set(bearer(h.token(USER)))
        .expect(403);
    });
    it("200 for a member user and resolves domain FQDNs", async () => {
      findGroupMemberIds.mockResolvedValueOnce([USER.id]);
      findGroupGlobalPermissions.mockResolvedValueOnce([]);
      findGroupDomainPermissions.mockResolvedValueOnce([{ domainId: 2, action: "access" }]);
      domainRepo.findBy.mockResolvedValueOnce([{ id: 2, domain: "two.test" }]);
      const res = await api()
        .get(`/api/v1/auth/jwt/me/groups/${GROUP_ID}/permissions`)
        .set(bearer(h.token(USER)))
        .expect(200);
      expect(res.body.domainPermissions[0].domainName).toBe("two.test");
    });
  });
});
