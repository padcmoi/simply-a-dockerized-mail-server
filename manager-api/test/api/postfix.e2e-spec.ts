import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { PostfixController } from "../../src/api/postfix/postfix.controller";
import { PostfixService } from "../../src/core/postfix/postfix.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("PostfixController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = { queueStats: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [PostfixController],
      providers: [{ provide: PostfixService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;
  const url = "/api/v1/postfix/queue";

  it("401 without a token", async () => {
    await api().get(url).expect(401);
  });
  it("401 with a garbage bearer token", async () => {
    await api().get(url).set("Authorization", "Bearer nope").expect(401);
  });
  it("403 for a user without the permission", async () => {
    await api().get(url).set("Authorization", auth(USER)).expect(403);
  });
  it("200 for root and forwards no domain when the query is absent", async () => {
    svc.queueStats.mockResolvedValue({ total: { active: 0, deferred: 0, hold: 0, incoming: 0 }, available: true });
    const res = await api().get(url).set("Authorization", auth(ROOT)).expect(200);
    expect(res.body.available).toBe(true);
    expect(svc.queueStats).toHaveBeenCalledWith(undefined);
  });
  it("200 for root and forwards the domain query to the service", async () => {
    svc.queueStats.mockResolvedValue({ total: { active: 1, deferred: 0, hold: 0, incoming: 0 }, available: true });
    await api().get(url).query({ domain: "example.com" }).set("Authorization", auth(ROOT)).expect(200);
    expect(svc.queueStats).toHaveBeenCalledWith("example.com");
  });
  it("200 for a user granted the exact permission", async () => {
    h.cpg.grantGlobal("postfix", "access", "view-postfix-queue");
    svc.queueStats.mockResolvedValue({ total: { active: 0, deferred: 0, hold: 0, incoming: 0 }, available: true });
    await api().get(url).set("Authorization", auth(USER)).expect(200);
  });
});
