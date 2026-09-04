import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { SupervisionController } from "../../src/api/supervision/supervision.controller";
import { SupervisionHistoryService } from "../../src/core/supervision/supervision-history.service";
import { SupervisionRecorderService } from "../../src/core/supervision/supervision-recorder.service";
import { MACHINE_BUSY, MACHINE_SATURATED } from "../../src/core/supervision/machine-alerts.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("SupervisionController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const recorder = { latest: vi.fn(), recent: vi.fn() };
  const history = { read: vi.fn() };

  const snapshot = {
    at: 1770000000000,
    cores: 8,
    cpu: 3.5,
    load: { one: 0.23, five: 0.3, fifteen: 0.27 },
    memory: { total: 100, used: 20 },
    network: { interface: "eth0", in: 10, out: 5 },
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [SupervisionController],
      providers: [
        { provide: SupervisionRecorderService, useValue: recorder },
        { provide: SupervisionHistoryService, useValue: history },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    vi.clearAllMocks();
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;
  const live = "/api/v1/supervision/live";
  const hour = "/api/v1/supervision/history/hour";

  describe("GET /supervision/live", () => {
    it("401 without a token", async () => {
      await api().get(live).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(live).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(live).set("Authorization", auth(USER)).expect(403);
    });
    it("403 for a user holding access but not view-machine-metrics", async () => {
      h.cpg.grantGlobal("supervision", "access");
      await api().get(live).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("supervision", "access", "view-machine-metrics");
      recorder.latest.mockReturnValue(snapshot);
      recorder.recent.mockReturnValue([snapshot]);
      const res = await api().get(live).set("Authorization", auth(USER)).expect(200);
      // The thresholds travel with the window: the interface paints its red
      // with the numbers the machine notifies on, not with its own copy.
      expect(res.body).toEqual({
        snapshot,
        points: [snapshot],
        thresholds: { busy: MACHINE_BUSY, saturated: MACHINE_SATURATED },
      });
    });
    it("200 for root, and answers with a null snapshot before the first sample", async () => {
      recorder.latest.mockReturnValue(null);
      recorder.recent.mockReturnValue([]);
      const res = await api().get(live).set("Authorization", auth(ROOT)).expect(200);
      expect(res.body).toMatchObject({ snapshot: null, points: [] });
    });
  });

  describe("GET /supervision/history/:range", () => {
    it("401 without a token", async () => {
      await api().get(hour).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(hour).set("Authorization", auth(USER)).expect(403);
    });
    // The two routes carry two different actions on purpose: the recorded month
    // is not the live minute, and holding one must not hand over the other.
    it("403 for a user holding only the live-metrics permission", async () => {
      h.cpg.grantGlobal("supervision", "access", "view-machine-metrics");
      await api().get(hour).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for a user granted the exact permission, and forwards the range", async () => {
      h.cpg.grantGlobal("supervision", "access", "view-metrics-history");
      const window = { range: "hour", step: 60000, points: [] };
      history.read.mockResolvedValue(window);
      const res = await api().get(hour).set("Authorization", auth(USER)).expect(200);
      expect(res.body).toEqual(window);
      expect(history.read).toHaveBeenCalledWith("hour");
    });
    it.each(["day", "week"])("200 for root on the %s window", async (range) => {
      history.read.mockResolvedValue({ range, step: 1, points: [] });
      await api().get(`/api/v1/supervision/history/${range}`).set("Authorization", auth(ROOT)).expect(200);
      expect(history.read).toHaveBeenCalledWith(range);
    });
    it("400 on an unknown range, without asking the service", async () => {
      await api().get("/api/v1/supervision/history/month").set("Authorization", auth(ROOT)).expect(400);
      expect(history.read).not.toHaveBeenCalled();
    });
    // Object.hasOwn on a plain object literal, so a prototype key is not a range.
    it("400 on a prototype key rather than reading a window for it", async () => {
      await api().get("/api/v1/supervision/history/constructor").set("Authorization", auth(ROOT)).expect(400);
      expect(history.read).not.toHaveBeenCalled();
    });
    it("403 before 400: an unknown range is not a way to probe the route", async () => {
      await api().get("/api/v1/supervision/history/month").set("Authorization", auth(USER)).expect(403);
    });
  });
});
