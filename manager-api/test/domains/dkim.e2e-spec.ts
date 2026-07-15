import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DkimController } from "../../src/api/domains/dkim/dkim.controller";
import { DkimService } from "../../src/core/dkim/dkim.service";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("DkimController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const dkim = {
    list: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
  };
  // Own VirtualDomain repo (wins over the harness default): lets us drive both
  // the domain string the controller resolves AND the ownerId the guard reads.
  const domainState = { ownerId: null as string | null, missing: false };
  const domainRepo = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) =>
      domainState.missing ? null : ({ id: where.id, domain: `D${where.id}.TEST`, ownerId: domainState.ownerId } as VirtualDomain)
    ),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [DkimController],
      providers: [
        { provide: DkimService, useValue: dkim },
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
      await api().get("/api/v1/domains/1/dkim").expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get("/api/v1/domains/1/dkim").set("Authorization", "Bearer nope").expect(401);
    });
  });

  describe("ACL (403 vs 2xx)", () => {
    it("403 on GET for a non-root user without any grant", async () => {
      await api().get("/api/v1/domains/1/dkim").set("Authorization", auth(USER)).expect(403);
    });

    it("403 on DELETE for a non-root user (global domain_owner_elevated gate)", async () => {
      await api().delete("/api/v1/domains/1/dkim/dkim202601").set("Authorization", auth(USER)).expect(403);
    });

    it("200 on GET for a non-root user through the ownership bypass", async () => {
      domainState.ownerId = USER.id;
      dkim.list.mockResolvedValueOnce([]);
      await api().get("/api/v1/domains/1/dkim").set("Authorization", auth(USER)).expect(200);
      expect(dkim.list).toHaveBeenCalledWith("d1.test");
    });
  });

  describe("GET / (list)", () => {
    it("200 for root and lists the lower-cased resolved domain", async () => {
      dkim.list.mockResolvedValueOnce([{ selector: "dkim202601" }]);
      const res = await api().get("/api/v1/domains/2/dkim").set("Authorization", auth(ROOT)).expect(200);
      expect(res.body).toEqual([{ selector: "dkim202601" }]);
      expect(dkim.list).toHaveBeenCalledWith("d2.test");
    });

    it("404 when the domain does not exist", async () => {
      domainState.missing = true;
      await api().get("/api/v1/domains/999/dkim").set("Authorization", auth(ROOT)).expect(404);
    });

    it("400 when :domainId is not an integer", async () => {
      await api().get("/api/v1/domains/abc/dkim").set("Authorization", auth(ROOT)).expect(400);
    });
  });

  describe("POST /rotate", () => {
    it("201 for root: purges existing keys then mints a new one", async () => {
      dkim.removeAll.mockResolvedValueOnce(undefined);
      dkim.create.mockResolvedValueOnce({ selector: "dkim202607", domain: "d1.test" });
      await api().post("/api/v1/domains/1/dkim/rotate").set("Authorization", auth(ROOT)).expect(201);
      expect(dkim.removeAll).toHaveBeenCalledWith("d1.test");
      expect(dkim.create).toHaveBeenCalledWith("d1.test");
    });

    it("201 even when the purge rejects (swallowed by .catch)", async () => {
      dkim.removeAll.mockRejectedValueOnce(new Error("sidecar down"));
      dkim.create.mockResolvedValueOnce({ selector: "dkim202607" });
      await api().post("/api/v1/domains/1/dkim/rotate").set("Authorization", auth(ROOT)).expect(201);
      expect(dkim.create).toHaveBeenCalledWith("d1.test");
    });

    it("400 when :domainId is not an integer", async () => {
      await api().post("/api/v1/domains/abc/dkim/rotate").set("Authorization", auth(ROOT)).expect(400);
    });
  });

  describe("DELETE /:selector", () => {
    it("200 for root and forwards domain + selector", async () => {
      dkim.remove.mockResolvedValueOnce({ domain: "d1.test", selector: "dkim202601" });
      await api().delete("/api/v1/domains/1/dkim/dkim202601").set("Authorization", auth(ROOT)).expect(200);
      expect(dkim.remove).toHaveBeenCalledWith("d1.test", "dkim202601");
    });

    it("400 when :domainId is not an integer", async () => {
      await api().delete("/api/v1/domains/abc/dkim/dkim202601").set("Authorization", auth(ROOT)).expect(400);
    });
  });
});
