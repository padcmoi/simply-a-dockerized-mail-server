import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AccountsController } from "../../src/api/accounts/crud/crud.controller";
import { AccountsService } from "../../src/api/accounts/crud/crud.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// A well-formed uuid so ParseUUIDPipe passes and only the guard / body pipe can
// reject; a deliberately malformed one is used for the 400 assertions.
const UUID = "11111111-1111-1111-1111-111111111111";

// The supertest verbs the auth sweep dispatches, so `api()[method]` stays typed
// instead of laundered through a cast.
type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

// Core account management (CRUD). Sessions and invitations are separate
// controllers with their own e2e specs.
describe("AccountsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    listNames: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    getOverview: vi.fn(),
    updateAccount: vi.fn(),
    revokeAccount: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const call = (method: HttpMethod, path: string) => api()[method](path);

  // Every guarded route, exercised for the two auth failures in one sweep.
  const PROTECTED: Array<[HttpMethod, string]> = [
    ["get", "/api/v1/accounts/names"],
    ["get", "/api/v1/accounts"],
    ["get", `/api/v1/accounts/${UUID}`],
    ["get", `/api/v1/accounts/${UUID}/overview`],
    ["patch", `/api/v1/accounts/${UUID}/edit`],
    ["delete", `/api/v1/accounts/${UUID}`],
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
});
