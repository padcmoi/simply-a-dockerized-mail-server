import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { MySpaceController } from "../../src/api/my-space/my-space.controller";
import { MySpaceService } from "../../src/api/my-space/my-space.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/my-space";

type Method = "get" | "patch" | "delete" | "post";

describe("MySpaceController (e2e: auth + behavior)", () => {
  let h: Harness;
  const svc = {
    myDelegations: vi.fn(),
    createRecipient: vi.fn(),
    createAlias: vi.fn(),
    getRecipient: vi.fn(),
    updateRecipient: vi.fn(),
    deleteRecipient: vi.fn(),
    getAlias: vi.fn(),
    updateAlias: vi.fn(),
    deleteAlias: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [MySpaceController],
      providers: [{ provide: MySpaceService, useValue: svc }],
    });
  });
  afterAll(() => h.close());

  const api = () => request(h.app.getHttpServer());
  const user = () => `Bearer ${h.token(USER)}`;
  const root = () => `Bearer ${h.token(ROOT)}`;
  const call = (m: Method, path: string) => {
    if (m === "get") return api().get(path);
    if (m === "delete") return api().delete(path);
    if (m === "post") return api().post(path);
    return api().patch(path);
  };

  // Every route is authenticated but ACL-free (ownership decides access inside the
  // service), so the sweep only needs the 401 cases; the 403 sweep has no meaning.
  const routes: { name: string; method: Method; path: string }[] = [
    { name: "GET delegations", method: "get", path: `${base}/delegations` },
    { name: "POST recipient on delegated domain", method: "post", path: `${base}/domains/1/recipients` },
    { name: "POST alias on delegated domain", method: "post", path: `${base}/domains/1/aliases` },
    { name: "GET recipient", method: "get", path: `${base}/recipients/5` },
    { name: "PATCH recipient", method: "patch", path: `${base}/recipients/5` },
    { name: "DELETE recipient", method: "delete", path: `${base}/recipients/5` },
    { name: "GET alias", method: "get", path: `${base}/aliases/7` },
    { name: "PATCH alias", method: "patch", path: `${base}/aliases/7` },
    { name: "DELETE alias", method: "delete", path: `${base}/aliases/7` },
  ];

  describe("auth (401)", () => {
    for (const r of routes) {
      it(`401 without a token -- ${r.name}`, async () => {
        await call(r.method, r.path).expect(401);
      });
      it(`401 with a garbage bearer token -- ${r.name}`, async () => {
        await call(r.method, r.path).set("Authorization", "Bearer nope").expect(401);
      });
    }
  });

  describe("delegated self-service", () => {
    it("GET /delegations forwards the caller id", async () => {
      svc.myDelegations.mockResolvedValueOnce([]);
      await api().get(`${base}/delegations`).set("Authorization", user()).expect(200);
      expect(svc.myDelegations).toHaveBeenCalledWith(USER.id);
    });

    it("POST /domains/:domainId/recipients forwards caller, domain and parsed body", async () => {
      svc.createRecipient.mockResolvedValueOnce({ id: 1 });
      const body = { localPart: "jdoe", password: "correcthorse", quota: 104857600 };
      await api().post(`${base}/domains/1/recipients`).set("Authorization", user()).send(body).expect(201);
      expect(svc.createRecipient).toHaveBeenCalledWith(USER.id, 1, body);
    });

    it("POST recipients: 400 on a missing password, service untouched", async () => {
      await api().post(`${base}/domains/1/recipients`).set("Authorization", user()).send({ localPart: "j", quota: 1 }).expect(400);
      expect(svc.createRecipient).not.toHaveBeenCalled();
    });

    it("POST /domains/:domainId/aliases forwards caller, domain and lowercased destination", async () => {
      svc.createAlias.mockResolvedValueOnce({ id: 2 });
      await api()
        .post(`${base}/domains/1/aliases`)
        .set("Authorization", user())
        .send({ localPart: "jdoe", destination: "D@Ex.com" })
        .expect(201);
      expect(svc.createAlias).toHaveBeenCalledWith(USER.id, 1, { localPart: "jdoe", destination: "d@ex.com" });
    });

    it("POST aliases: 400 when :domainId is not an integer", async () => {
      await api()
        .post(`${base}/domains/x/aliases`)
        .set("Authorization", user())
        .send({ localPart: "j", destination: "d@ex.com" })
        .expect(400);
    });
  });

  describe("GET /recipients/:id", () => {
    it("200 for an authenticated caller, forwards its own id + the recipient id", async () => {
      svc.getRecipient.mockResolvedValueOnce({
        id: 5,
        email: "a@ex.com",
        domain: "ex.com",
        quota: "1048576",
        usedBytes: "0",
        active: true,
      });
      const res = await api().get(`${base}/recipients/5`).set("Authorization", user()).expect(200);
      expect(res.body).toMatchObject({ id: 5, email: "a@ex.com" });
      expect(svc.getRecipient).toHaveBeenCalledWith(USER.id, 5);
    });

    it("400 when :id is not an integer", async () => {
      await api().get(`${base}/recipients/abc`).set("Authorization", user()).expect(400);
      expect(svc.getRecipient).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /recipients/:id", () => {
    it("200, forwards the caller id + the parsed body", async () => {
      svc.updateRecipient.mockResolvedValueOnce({ id: 5, active: false });
      await api().patch(`${base}/recipients/5`).set("Authorization", user()).send({ active: false }).expect(200);
      expect(svc.updateRecipient).toHaveBeenCalledWith(USER.id, 5, { active: false });
    });

    it("200 for a root caller too (no ACL, ownership is decided in the service)", async () => {
      svc.updateRecipient.mockResolvedValueOnce({ id: 5 });
      await api().patch(`${base}/recipients/5`).set("Authorization", root()).send({ password: "supersecret" }).expect(200);
      expect(svc.updateRecipient).toHaveBeenCalledWith(ROOT.id, 5, { password: "supersecret" });
    });

    it("400 on an empty body (at least one field is required)", async () => {
      await api().patch(`${base}/recipients/5`).set("Authorization", user()).send({}).expect(400);
    });

    it("400 on a password below the 8-character minimum", async () => {
      await api().patch(`${base}/recipients/5`).set("Authorization", user()).send({ password: "short" }).expect(400);
    });

    it("400 on an unknown field (strict schema rejects a rename)", async () => {
      await api().patch(`${base}/recipients/5`).set("Authorization", user()).send({ email: "x@y.z" }).expect(400);
    });

    it("200, forwards a quota change to the service", async () => {
      svc.updateRecipient.mockResolvedValueOnce({ id: 5 });
      await api().patch(`${base}/recipients/5`).set("Authorization", user()).send({ quota: 10485760 }).expect(200);
      expect(svc.updateRecipient).toHaveBeenCalledWith(USER.id, 5, { quota: 10485760 });
    });

    it("400 on a quota below the 1 MB minimum", async () => {
      await api().patch(`${base}/recipients/5`).set("Authorization", user()).send({ quota: 1024 }).expect(400);
    });
  });

  describe("DELETE /recipients/:id", () => {
    it("200, forwards the caller id + the recipient id", async () => {
      svc.deleteRecipient.mockResolvedValueOnce({ ok: true });
      await api().delete(`${base}/recipients/5`).set("Authorization", user()).expect(200);
      expect(svc.deleteRecipient).toHaveBeenCalledWith(USER.id, 5);
    });

    it("400 when :id is not an integer", async () => {
      await api().delete(`${base}/recipients/abc`).set("Authorization", user()).expect(400);
      expect(svc.deleteRecipient).not.toHaveBeenCalled();
    });
  });

  describe("GET /aliases/:id", () => {
    it("200, forwards the caller id + the alias id", async () => {
      svc.getAlias.mockResolvedValueOnce({ id: 7, source: "a@ex.com", destination: "b@ex.com", domain: "ex.com" });
      await api().get(`${base}/aliases/7`).set("Authorization", user()).expect(200);
      expect(svc.getAlias).toHaveBeenCalledWith(USER.id, 7);
    });

    it("400 when :id is not an integer", async () => {
      await api().get(`${base}/aliases/xyz`).set("Authorization", user()).expect(400);
      expect(svc.getAlias).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /aliases/:id", () => {
    it("200, forwards the caller id + the lowercased destination", async () => {
      svc.updateAlias.mockResolvedValueOnce({ id: 7, destination: "c@ex.com" });
      await api().patch(`${base}/aliases/7`).set("Authorization", user()).send({ destination: "C@Ex.com" }).expect(200);
      expect(svc.updateAlias).toHaveBeenCalledWith(USER.id, 7, { destination: "c@ex.com" });
    });

    it("400 on a destination that is not an email", async () => {
      await api().patch(`${base}/aliases/7`).set("Authorization", user()).send({ destination: "not-an-email" }).expect(400);
      expect(svc.updateAlias).not.toHaveBeenCalled();
    });

    it("400 on an unknown field (strict schema rejects localPart)", async () => {
      await api().patch(`${base}/aliases/7`).set("Authorization", user()).send({ localPart: "x" }).expect(400);
    });
  });

  describe("DELETE /aliases/:id", () => {
    it("200, forwards the caller id + the alias id", async () => {
      svc.deleteAlias.mockResolvedValueOnce({ ok: true });
      await api().delete(`${base}/aliases/7`).set("Authorization", user()).expect(200);
      expect(svc.deleteAlias).toHaveBeenCalledWith(USER.id, 7);
    });

    it("400 when :id is not an integer", async () => {
      await api().delete(`${base}/aliases/xyz`).set("Authorization", user()).expect(400);
      expect(svc.deleteAlias).not.toHaveBeenCalled();
    });
  });
});
