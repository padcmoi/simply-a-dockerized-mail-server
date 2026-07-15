import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { HealthController } from "../../src/api/health/health.controller";
import { HealthcheckService } from "../../src/core/healthcheck/healthcheck.service";
import { buildHarness, type Harness } from "../helpers/e2e";

// GET /health is @Public: reachable with no Authorization header at all, and
// even a garbage token is ignored because the public short-circuit runs before
// any strategy. The controller just wraps the mocked snapshot.
describe("HealthController (e2e: public)", () => {
  let h: Harness;
  const snapshot = { status: "ok", cpu: "low", memory: "low", redis: "ok", db: "ok" };
  const healthcheck = { snapshot: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [HealthController],
      providers: [{ provide: HealthcheckService, useValue: healthcheck }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => healthcheck.snapshot.mockReset());

  const api = () => request(h.app.getHttpServer());

  it("200 with no token and wraps the snapshot under `healthcheck`", async () => {
    healthcheck.snapshot.mockResolvedValueOnce(snapshot);
    const res = await api().get("/api/v1/health").expect(200);
    expect(res.body).toEqual({ healthcheck: snapshot });
    expect(healthcheck.snapshot).toHaveBeenCalledTimes(1);
  });

  it("200 even with a garbage bearer token (public short-circuit)", async () => {
    healthcheck.snapshot.mockResolvedValueOnce(snapshot);
    await api().get("/api/v1/health").set("Authorization", "Bearer nope").expect(200);
  });
});
