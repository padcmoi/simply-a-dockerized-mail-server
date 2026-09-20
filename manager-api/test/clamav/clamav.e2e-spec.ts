import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import request from "supertest";
import { ClamavController } from "../../src/api/clamav/clamav.controller";
import { ActivityLogService } from "../../src/core/activity/activity-log.service";
import { ClamavService } from "../../src/core/clamav/clamav.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("ClamavController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const clamav = { status: vi.fn(), update: vi.fn(), reload: vi.fn() };
  const activity = { record: vi.fn() };

  const status = {
    available: true,
    engine: { version: "1.4.6", published: "1.4.6", outdated: false },
    signaturesAt: 1789885560000,
    databases: [],
    stats: null,
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [ClamavController],
      providers: [
        { provide: ClamavService, useValue: clamav },
        { provide: ActivityLogService, useValue: activity },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    vi.clearAllMocks();
    clamav.status.mockResolvedValue(status);
    clamav.update.mockResolvedValue({ output: ["up to date"], updated: false, status });
    clamav.reload.mockResolvedValue({ status });
    activity.record.mockResolvedValue(undefined);
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  describe("GET /clamav/status", () => {
    const url = "/api/v1/clamav/status";

    it("401 without a token", async () => {
      await api().get(url).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(url).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().get(url).set("Authorization", auth(USER)).expect(403);
    });
    it("403 for a user holding access but not view-clamav-status", async () => {
      h.cpg.grantGlobal("clamav", "access", "update-signatures", "reload-database");
      await api().get(url).set("Authorization", auth(USER)).expect(403);
      expect(clamav.status).not.toHaveBeenCalled();
    });
    it("200 for a user granted the exact permission", async () => {
      h.cpg.grantGlobal("clamav", "access", "view-clamav-status");
      const res = await api().get(url).set("Authorization", auth(USER)).expect(200);
      expect(res.body).toEqual(status);
    });
    it("200 for root", async () => {
      await api().get(url).set("Authorization", auth(ROOT)).expect(200);
    });
  });

  describe("POST /clamav/update", () => {
    const url = "/api/v1/clamav/update";

    it("401 without a token", async () => {
      await api().post(url).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().post(url).set("Authorization", auth(USER)).expect(403);
      expect(clamav.update).not.toHaveBeenCalled();
    });
    it("403 for a user holding only view-clamav-status and reload-database", async () => {
      h.cpg.grantGlobal("clamav", "access", "view-clamav-status", "reload-database");
      await api().post(url).set("Authorization", auth(USER)).expect(403);
      expect(clamav.update).not.toHaveBeenCalled();
    });
    it("200 for a user granted update-signatures, and writes what it did to the journal", async () => {
      h.cpg.grantGlobal("clamav", "access", "update-signatures");
      const res = await api().post(url).set("Authorization", auth(USER)).expect(200);

      expect(res.body).toEqual({ output: ["up to date"], updated: false, status });
      expect(activity.record).toHaveBeenCalledWith({
        action: "clamav.updated",
        entity: { type: "service", label: "clamav" },
        details: { updated: false },
      });
    });
    it("carries in the journal that something was actually downloaded", async () => {
      clamav.update.mockResolvedValue({ output: ["got daily"], updated: true, status });
      await api().post(url).set("Authorization", auth(ROOT)).expect(200);
      expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ details: { updated: true } }));
    });
    it("409, and no journal line, while an update is already running", async () => {
      clamav.update.mockRejectedValue(new ConflictException("An update is already running"));
      await api().post(url).set("Authorization", auth(ROOT)).expect(409);
      expect(activity.record).not.toHaveBeenCalled();
    });
    it("503, and no journal line, when the updater is out of reach", async () => {
      clamav.update.mockRejectedValue(new ServiceUnavailableException("The antivirus updater is out of reach"));
      await api().post(url).set("Authorization", auth(ROOT)).expect(503);
      expect(activity.record).not.toHaveBeenCalled();
    });
  });

  describe("POST /clamav/reload", () => {
    const url = "/api/v1/clamav/reload";

    it("401 without a token", async () => {
      await api().post(url).expect(401);
    });
    it("403 for a user without the permission", async () => {
      await api().post(url).set("Authorization", auth(USER)).expect(403);
      expect(clamav.reload).not.toHaveBeenCalled();
    });
    it("403 for a user holding only view-clamav-status and update-signatures", async () => {
      h.cpg.grantGlobal("clamav", "access", "view-clamav-status", "update-signatures");
      await api().post(url).set("Authorization", auth(USER)).expect(403);
      expect(clamav.reload).not.toHaveBeenCalled();
    });
    it("200 for a user granted reload-database, and writes it to the journal", async () => {
      h.cpg.grantGlobal("clamav", "access", "reload-database");
      const res = await api().post(url).set("Authorization", auth(USER)).expect(200);

      expect(res.body).toEqual({ status });
      expect(activity.record).toHaveBeenCalledWith({
        action: "clamav.reloaded",
        entity: { type: "service", label: "clamav" },
      });
    });
    it("503, and no journal line, when clamd is out of reach", async () => {
      clamav.reload.mockRejectedValue(new ServiceUnavailableException("The antivirus is out of reach"));
      await api().post(url).set("Authorization", auth(ROOT)).expect(503);
      expect(activity.record).not.toHaveBeenCalled();
    });
  });
});
