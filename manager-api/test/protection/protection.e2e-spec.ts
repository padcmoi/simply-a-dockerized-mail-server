import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { NotFoundException } from "@nestjs/common";
import { ProtectionController } from "../../src/api/protection/protection.controller";
import { ActivityLogService } from "../../src/core/activity/activity-log.service";
import { RootGuard } from "../../src/core/auth/root.guard";
import { ProtectionService } from "../../src/core/protection/protection.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("ProtectionController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = { setProtected: vi.fn() };
  const activity = { record: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [ProtectionController],
      providers: [RootGuard, { provide: ProtectionService, useValue: svc }, { provide: ActivityLogService, useValue: activity }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    svc.setProtected.mockReset().mockResolvedValue("j@example.com");
    activity.record.mockReset().mockResolvedValue(undefined);
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  describe("PUT /protection/:type/:id", () => {
    const url = "/api/v1/protection/recipient/41";
    it("401 without a token", async () => {
      await api().put(url).expect(401);
    });
    it("403 without the permission", async () => {
      await api().put(url).set("Authorization", auth(USER)).expect(403);
      expect(svc.setProtected).not.toHaveBeenCalled();
    });
    it("403 with misc:access alone", async () => {
      h.cpg.grantGlobal("misc", "access");
      await api().put(url).set("Authorization", auth(USER)).expect(403);
      expect(svc.setProtected).not.toHaveBeenCalled();
    });
    it("403 with a superadmin grant that no longer carries the action", async () => {
      h.cpg.grantGlobal("superadmin", "access", "resize-any-domain-quota", "delete-any-domain");
      await api().put(url).set("Authorization", auth(USER)).expect(403);
      expect(svc.setProtected).not.toHaveBeenCalled();
    });
    it("204 with protect-resource, journaled", async () => {
      h.cpg.grantGlobal("misc", "access", "protect-resource");
      await api().put(url).set("Authorization", auth(USER)).expect(204);
      expect(svc.setProtected).toHaveBeenCalledWith("recipient", "41", true);
      expect(activity.record).toHaveBeenCalledWith({
        action: "protection.enabled",
        entity: { type: "recipient", id: "41", label: "j@example.com" },
      });
    });
    for (const type of ["account", "domain"]) {
      it(`403 on a ${type} for a non-root account, even one allowed to protect`, async () => {
        h.cpg.grantGlobal("misc", "access", "protect-resource");
        await api().put(`/api/v1/protection/${type}/12`).set("Authorization", auth(USER)).expect(403);
        expect(svc.setProtected).not.toHaveBeenCalled();
      });
    }
    it("204 on a mailbox and an alias for that same account", async () => {
      h.cpg.grantGlobal("misc", "access", "protect-resource");
      await api().put("/api/v1/protection/recipient/12").set("Authorization", auth(USER)).expect(204);
      await api().put("/api/v1/protection/alias/12").set("Authorization", auth(USER)).expect(204);
    });
    it("204 for root on each type", async () => {
      for (const type of ["account", "recipient", "alias", "domain"]) {
        await api().put(`/api/v1/protection/${type}/12`).set("Authorization", auth(ROOT)).expect(204);
      }
      expect(svc.setProtected).toHaveBeenCalledTimes(4);
    });
    for (const [type, id] of [
      ["mailbox", "41"],
      ["recipient", "41%20OR%201"],
      ["recipient", "a".repeat(65)],
    ]) {
      it(`400 for ${type}/${id.slice(0, 12)}`, async () => {
        await api().put(`/api/v1/protection/${type}/${id}`).set("Authorization", auth(ROOT)).expect(400);
        expect(svc.setProtected).not.toHaveBeenCalled();
      });
    }
    it("404 for an unknown resource, nothing journaled", async () => {
      svc.setProtected.mockRejectedValue(new NotFoundException("recipient #999 not found"));
      await api().put("/api/v1/protection/recipient/999").set("Authorization", auth(ROOT)).expect(404);
      expect(activity.record).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /protection/:type/:id", () => {
    const url = "/api/v1/protection/domain/1";
    it("401 without a token", async () => {
      await api().delete(url).expect(401);
    });
    it("403 without the permission", async () => {
      await api().delete(url).set("Authorization", auth(USER)).expect(403);
    });
    it("403 for a non-root account, even one allowed to protect", async () => {
      h.cpg.grantGlobal("misc", "access", "protect-resource");
      await api().delete(url).set("Authorization", auth(USER)).expect(403);
      expect(svc.setProtected).not.toHaveBeenCalled();
    });
    it("204 for root, journaled", async () => {
      await api().delete(url).set("Authorization", auth(ROOT)).expect(204);
      expect(svc.setProtected).toHaveBeenCalledWith("domain", "1", false);
      expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: "protection.disabled" }));
    });
  });
});
