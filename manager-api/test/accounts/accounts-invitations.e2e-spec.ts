import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AccountsInvitationsController } from "../../src/api/accounts/invitations/invitations.controller";
import { AccountsInvitationsService } from "../../src/api/accounts/invitations/invitations.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// The account invitation lifecycle: sending an invite (guarded) plus the two
// @Public() routes that read and accept it.
describe("AccountsInvitationsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    sendInvitation: vi.fn(),
    getInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AccountsInvitationsController],
      providers: [{ provide: AccountsInvitationsService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());

  describe("auth (401) on the guarded route", () => {
    it("401 without a token: POST /api/v1/accounts/invite", async () => {
      await api().post("/api/v1/accounts/invite").expect(401);
    });
    it("401 with a garbage bearer token: POST /api/v1/accounts/invite", async () => {
      await api().post("/api/v1/accounts/invite").set("Authorization", "Bearer nope").expect(401);
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
        .send({ email: "new@user.com", domainId: 1 })
        .expect(201);
    });

    it("201 for root and forwards the acting user + validated body + base url", async () => {
      svc.sendInvitation.mockResolvedValueOnce({ ok: true });
      await api()
        .post("/api/v1/accounts/invite")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ email: "new@user.com", domainId: 2 })
        .expect(201);
      expect(svc.sendInvitation).toHaveBeenCalledWith(
        { id: ROOT.id, email: ROOT.email, isRoot: true },
        {
          email: "new@user.com",
          domainId: 2,
          groupIds: [],
          recipientIds: [],
          aliasIds: [],
          makeOwner: false,
          useDomainGroup: false,
        },
        expect.any(String)
      );
    });

    it("400 on an invalid email (zod)", async () => {
      await api()
        .post("/api/v1/accounts/invite")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ email: "not-an-email", domainId: 1 })
        .expect(400);
    });

    it("400 when the domain is missing (zod: domain is mandatory)", async () => {
      await api()
        .post("/api/v1/accounts/invite")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send({ email: "new@user.com" })
        .expect(400);
    });
  });

  // The two invitation routes are @Public(): no Authorization header, no ACL.
  describe("GET /accounts/invite/:token (public)", () => {
    it("200 with no Authorization header and forwards the token", async () => {
      svc.getInvitation.mockResolvedValueOnce({ email: "x@y.com", groups: [], expiresAt: new Date() });
      await api().get("/api/v1/accounts/invite/tok-123").expect(200);
      expect(svc.getInvitation).toHaveBeenCalledWith("tok-123");
    });
  });

  describe("POST /accounts/invite/:token/accept (public)", () => {
    it("201 with no Authorization header and forwards token + body", async () => {
      svc.acceptInvitation.mockResolvedValueOnce({ ok: true, email: "x@y.com" });
      await api().post("/api/v1/accounts/invite/tok-123/accept").send({ password: "longenough", firstName: "Jo" }).expect(201);
      expect(svc.acceptInvitation).toHaveBeenCalledWith("tok-123", { password: "longenough", firstName: "Jo" });
    });

    it("400 on an invalid body (zod: password too short)", async () => {
      await api().post("/api/v1/accounts/invite/tok-123/accept").send({ password: "short" }).expect(400);
    });
  });
});
