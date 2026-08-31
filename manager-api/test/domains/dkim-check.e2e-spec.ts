import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DkimCheckController } from "../../src/api/domains/dkim-check/dkim-check.controller";
import { DkimCheckService } from "../../src/api/domains/dkim-check/dkim-check.service";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("DkimCheckController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const dkimCheck = { check: vi.fn() };
  const domainState = { ownerId: null as string | null, missing: false };
  const domainRepo = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) =>
      domainState.missing ? null : ({ id: where.id, domain: `D${where.id}.TEST`, ownerId: domainState.ownerId } as VirtualDomain)
    ),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [DkimCheckController],
      providers: [
        { provide: DkimCheckService, useValue: dkimCheck },
        { provide: getRepositoryToken(VirtualDomain), useValue: domainRepo },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    domainState.ownerId = null;
    domainState.missing = false;
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  describe("auth (401)", () => {
    it("401 without a token", async () => {
      await api().get("/api/v1/domains/1/dkim-check").expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get("/api/v1/domains/1/dkim-check").set("Authorization", "Bearer nope").expect(401);
    });
  });

  describe("ACL (403 vs 2xx)", () => {
    it("403 for a non-root user without any grant", async () => {
      await api().get("/api/v1/domains/1/dkim-check").set("Authorization", auth(USER)).expect(403);
    });

    it("200 for a non-root user through the ownership bypass", async () => {
      domainState.ownerId = USER.id;
      dkimCheck.check.mockResolvedValueOnce({ domain: "d1.test", match: true });
      await api().get("/api/v1/domains/1/dkim-check").set("Authorization", auth(USER)).expect(200);
      expect(dkimCheck.check).toHaveBeenCalledWith("d1.test");
    });
  });

  describe("GET / (check)", () => {
    it("200 for root and checks the lower-cased resolved domain", async () => {
      dkimCheck.check.mockResolvedValueOnce({ domain: "d5.test", match: false, hasKeyInDatabase: false });
      const res = await api().get("/api/v1/domains/5/dkim-check").set("Authorization", auth(ROOT)).expect(200);
      expect(res.body.domain).toBe("d5.test");
      expect(dkimCheck.check).toHaveBeenCalledWith("d5.test");
    });

    it("404 when the domain does not exist", async () => {
      domainState.missing = true;
      await api().get("/api/v1/domains/999/dkim-check").set("Authorization", auth(ROOT)).expect(404);
      expect(dkimCheck.check).not.toHaveBeenCalled();
    });

    it("400 when :domainId is not an integer", async () => {
      await api().get("/api/v1/domains/abc/dkim-check").set("Authorization", auth(ROOT)).expect(400);
    });
  });
});
