import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AdminDomainsController } from "../../src/api/domains/admin-domains/admin-domains.controller";
import { DomainsService } from "../../src/api/domains/domains.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const ID = 5;
const QUOTA = 10485760; // MIN_DOMAIN_QUOTA_BYTES (10 MB)

describe("AdminDomainsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AdminDomainsController],
      providers: [{ provide: DomainsService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const asRoot = () => ["Authorization", `Bearer ${h.token(ROOT)}`] as [string, string];
  const asUser = () => ["Authorization", `Bearer ${h.token(USER)}`] as [string, string];

  describe("auth (401)", () => {
    const routes: Array<[string, () => request.Test]> = [
      ["PATCH /admin/domains/:id/quota", () => api().patch(`/api/v1/admin/domains/${ID}/quota`)],
      ["DELETE /admin/domains/:id", () => api().delete(`/api/v1/admin/domains/${ID}`)],
    ];
    for (const [name, build] of routes) {
      it(`401 without a token: ${name}`, async () => {
        await build().expect(401);
      });
      it(`401 with a garbage bearer token: ${name}`, async () => {
        await build().set("Authorization", "Bearer nope").expect(401);
      });
    }
  });

  describe("PATCH /admin/domains/:domainId/quota (resizeQuota)", () => {
    it("403 for a user without the superadmin grant", async () => {
      await api()
        .patch(`/api/v1/admin/domains/${ID}/quota`)
        .set(...asUser())
        .send({ quota: QUOTA })
        .expect(403);
    });

    it("403 for a user with only domains:access (missing superadmin)", async () => {
      h.cpg.grantGlobal("domains", "access");
      await api()
        .patch(`/api/v1/admin/domains/${ID}/quota`)
        .set(...asUser())
        .send({ quota: QUOTA })
        .expect(403);
    });

    it("200 for root and forwards id + parsed body", async () => {
      svc.update.mockResolvedValueOnce({ id: ID, quota: String(QUOTA) });
      await api()
        .patch(`/api/v1/admin/domains/${ID}/quota`)
        .set(...asRoot())
        .send({ quota: QUOTA })
        .expect(200);
      expect(svc.update).toHaveBeenCalledWith(ID, { quota: QUOTA });
    });

    it("200 for a user granted domains:access + superadmin:resize-any-domain-quota", async () => {
      h.cpg.grantGlobal("domains", "access");
      h.cpg.grantGlobal("superadmin", "access", "resize-any-domain-quota");
      svc.update.mockResolvedValueOnce({ id: ID });
      await api()
        .patch(`/api/v1/admin/domains/${ID}/quota`)
        .set(...asUser())
        .send({ quota: QUOTA })
        .expect(200);
      expect(svc.update).toHaveBeenCalledWith(ID, { quota: QUOTA });
    });

    it("400 on a below-minimum quota", async () => {
      await api()
        .patch(`/api/v1/admin/domains/${ID}/quota`)
        .set(...asRoot())
        .send({ quota: 5 })
        .expect(400);
    });

    it("400 on an unknown extra key (strict schema)", async () => {
      await api()
        .patch(`/api/v1/admin/domains/${ID}/quota`)
        .set(...asRoot())
        .send({ quota: QUOTA, domain: "rename.test" })
        .expect(400);
    });

    it("400 when :domainId is not an integer", async () => {
      await api()
        .patch("/api/v1/admin/domains/abc/quota")
        .set(...asRoot())
        .send({ quota: QUOTA })
        .expect(400);
    });
  });

  describe("DELETE /admin/domains/:domainId (remove)", () => {
    it("403 for a user without the superadmin grant", async () => {
      await api()
        .delete(`/api/v1/admin/domains/${ID}`)
        .set(...asUser())
        .expect(403);
    });

    it("200 for root and forwards the parsed id", async () => {
      svc.remove.mockResolvedValueOnce({ ok: true });
      await api()
        .delete(`/api/v1/admin/domains/${ID}`)
        .set(...asRoot())
        .expect(200);
      expect(svc.remove).toHaveBeenCalledWith(ID);
    });

    it("200 for a user granted domains:access + superadmin:delete-any-domain", async () => {
      h.cpg.grantGlobal("domains", "access");
      h.cpg.grantGlobal("superadmin", "access", "delete-any-domain");
      svc.remove.mockResolvedValueOnce({ ok: true });
      await api()
        .delete(`/api/v1/admin/domains/${ID}`)
        .set(...asUser())
        .expect(200);
      expect(svc.remove).toHaveBeenCalledWith(ID);
    });

    it("400 when :domainId is not an integer", async () => {
      await api()
        .delete("/api/v1/admin/domains/abc")
        .set(...asRoot())
        .expect(400);
    });
  });
});
