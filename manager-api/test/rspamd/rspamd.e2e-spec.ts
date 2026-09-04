import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { RspamdController } from "../../src/api/rspamd/rspamd.controller";
import { RspamdService } from "../../src/core/rspamd/rspamd.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("RspamdController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    stats: vi.fn(),
    history: vi.fn(),
    getActions: vi.fn(),
    saveActions: vi.fn(),
    resetActions: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [RspamdController],
      providers: [{ provide: RspamdService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  describe("GET /rspamd/stats", () => {
    const url = "/api/v1/rspamd/stats";
    it("401 without a token", async () => {
      await api().get(url).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(url).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(url).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for root and forwards to the service", async () => {
      svc.stats.mockResolvedValue({ version: "3.8", scanned: 10 });
      const res = await api().get(url).set("Authorization", auth(ROOT)).expect(200);
      expect(res.body.version).toBe("3.8");
      expect(svc.stats).toHaveBeenCalledTimes(1);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("rspamd", "access", "view-rspamd-stats");
      svc.stats.mockResolvedValue({ version: "3.8" });
      await api().get(url).set("Authorization", auth(USER)).expect(200);
    });
  });

  describe("GET /rspamd/history", () => {
    const url = "/api/v1/rspamd/history";
    it("401 without a token", async () => {
      await api().get(url).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(url).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(url).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for root, forwarding domain/size/query to the service", async () => {
      svc.history.mockResolvedValue({ items: [], total: 0 });
      await api().get(url).query({ domain: "example.com", size: "50", limit: "10" }).set("Authorization", auth(ROOT)).expect(200);
      expect(svc.history).toHaveBeenCalledWith("example.com", 50, expect.objectContaining({ limit: 10 }));
    });
    it("200 for root with no query params (unpaginated legacy call)", async () => {
      svc.history.mockResolvedValue([]);
      await api().get(url).set("Authorization", auth(ROOT)).expect(200);
      expect(svc.history).toHaveBeenCalledWith(undefined, undefined, expect.objectContaining({ sortDir: "desc" }));
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("rspamd", "access", "view-rspamd-history");
      svc.history.mockResolvedValue([]);
      await api().get(url).set("Authorization", auth(USER)).expect(200);
    });
    it("400 on an invalid pagination query (limit not 10/25/50)", async () => {
      await api().get(url).query({ limit: "7" }).set("Authorization", auth(ROOT)).expect(400);
    });
  });

  describe("GET /rspamd/actions", () => {
    const url = "/api/v1/rspamd/actions";
    it("401 without a token", async () => {
      await api().get(url).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(url).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(url).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for root and forwards to the service", async () => {
      svc.getActions.mockResolvedValue({ reject: 15, softReject: null, rewriteSubject: null, addHeader: 5, greylist: null });
      const res = await api().get(url).set("Authorization", auth(ROOT)).expect(200);
      expect(res.body.reject).toBe(15);
      expect(svc.getActions).toHaveBeenCalledTimes(1);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("rspamd", "access", "view-rspamd-thresholds");
      svc.getActions.mockResolvedValue({ reject: 15 });
      await api().get(url).set("Authorization", auth(USER)).expect(200);
    });
  });

  describe("PATCH /rspamd/actions", () => {
    const url = "/api/v1/rspamd/actions";
    const valid = { reject: 15, rewriteSubject: null, addHeader: 5, greylist: null };
    it("401 without a token", async () => {
      await api().patch(url).send(valid).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().patch(url).set("Authorization", "Bearer nope").send(valid).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().patch(url).set("Authorization", auth(USER)).send(valid).expect(403);
    });
    it("200 for root and forwards the validated body", async () => {
      svc.saveActions.mockResolvedValue(undefined);
      await api().patch(url).set("Authorization", auth(ROOT)).send(valid).expect(200);
      expect(svc.saveActions).toHaveBeenCalledWith(valid);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("rspamd", "access", "edit-rspamd-thresholds");
      svc.saveActions.mockResolvedValue(undefined);
      await api().patch(url).set("Authorization", auth(USER)).send(valid).expect(200);
    });
    it("400 on a negative threshold", async () => {
      await api()
        .patch(url)
        .set("Authorization", auth(ROOT))
        .send({ reject: -1, rewriteSubject: null, addHeader: null, greylist: null })
        .expect(400);
    });
    it("400 when thresholds are not strictly descending", async () => {
      await api()
        .patch(url)
        .set("Authorization", auth(ROOT))
        .send({ reject: 5, rewriteSubject: 10, addHeader: null, greylist: null })
        .expect(400);
    });
    it("400 on a missing field", async () => {
      await api().patch(url).set("Authorization", auth(ROOT)).send({ reject: 5 }).expect(400);
    });
  });

  describe("DELETE /rspamd/actions", () => {
    const url = "/api/v1/rspamd/actions";
    it("401 without a token", async () => {
      await api().delete(url).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().delete(url).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().delete(url).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for root and forwards to the service", async () => {
      svc.resetActions.mockResolvedValue(undefined);
      await api().delete(url).set("Authorization", auth(ROOT)).expect(200);
      expect(svc.resetActions).toHaveBeenCalledTimes(1);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("rspamd", "access", "reset-rspamd-thresholds");
      svc.resetActions.mockResolvedValue(undefined);
      await api().delete(url).set("Authorization", auth(USER)).expect(200);
    });
  });
});
