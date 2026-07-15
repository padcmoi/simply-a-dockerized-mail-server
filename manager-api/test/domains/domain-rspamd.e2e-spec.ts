import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DomainsRspamdController } from "../../src/api/domains/rspamd/rspamd.controller";
import { RspamdService } from "../../src/core/rspamd/rspamd.service";
import { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

// Domain ids kept distinct per intent: the harness `owners` map persists across
// tests (only cpg grants reset in beforeEach), so reusing an owned id elsewhere
// would leak ownership.
const ID_ROOT = 5;
const ID_FORBIDDEN = 12;
const ID_OWNED = 7;

describe("DomainsRspamdController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    history: vi.fn(),
    domainBayes: vi.fn(),
  };
  const usersRepo = { find: vi.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [DomainsRspamdController],
      providers: [
        { provide: RspamdService, useValue: svc },
        { provide: getRepositoryToken(VirtualUser), useValue: usersRepo },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    usersRepo.find.mockResolvedValue([]);
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  describe("GET /domains/:domainId/rspamd/history", () => {
    const url = (id: number | string) => `/api/v1/domains/${id}/rspamd/history`;
    it("401 without a token", async () => {
      await api().get(url(ID_ROOT)).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(url(ID_ROOT)).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a non-owner user without the domain permission", async () => {
      await api().get(url(ID_FORBIDDEN)).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for root, resolving the fqdn and forwarding size/query to the service", async () => {
      svc.history.mockResolvedValue({ items: [], total: 0 });
      await api().get(url(ID_ROOT)).query({ size: "50", limit: "10" }).set("Authorization", auth(ROOT)).expect(200);
      expect(svc.history).toHaveBeenCalledWith(`d${ID_ROOT}.test`, 50, expect.objectContaining({ limit: 10 }));
    });
    it("200 for the domain owner (ownership bypass, no grant)", async () => {
      h.setDomainOwner(ID_OWNED, USER.id);
      svc.history.mockResolvedValue([]);
      await api().get(url(ID_OWNED)).set("Authorization", auth(USER)).expect(200);
      expect(svc.history).toHaveBeenCalledWith(`d${ID_OWNED}.test`, undefined, expect.objectContaining({ sortDir: "desc" }));
    });
    it("400 when :domainId is not an integer", async () => {
      await api().get(url("abc")).set("Authorization", auth(ROOT)).expect(400);
    });
    it("400 on an invalid pagination query", async () => {
      await api().get(url(ID_ROOT)).query({ limit: "7" }).set("Authorization", auth(ROOT)).expect(400);
    });
  });

  describe("GET /domains/:domainId/rspamd/stats", () => {
    const url = (id: number | string) => `/api/v1/domains/${id}/rspamd/stats`;
    it("401 without a token", async () => {
      await api().get(url(ID_ROOT)).expect(401);
    });
    it("401 with a garbage bearer token", async () => {
      await api().get(url(ID_ROOT)).set("Authorization", "Bearer nope").expect(401);
    });
    it("403 for a non-owner user without the domain permission", async () => {
      await api().get(url(ID_FORBIDDEN)).set("Authorization", auth(USER)).expect(403);
    });
    it("200 for root: tallies actions, folds mailboxes into the Bayes card", async () => {
      svc.history.mockResolvedValue([
        { action: "reject", rcpt_smtp: [`a@d${ID_ROOT}.test`] },
        { action: "no action", rcpt_smtp: [`b@d${ID_ROOT}.test`] },
        { action: "no action", rcpt_smtp: [`b@d${ID_ROOT}.test`] },
      ]);
      svc.domainBayes.mockResolvedValue({
        recipients: [{ recipient: `b@d${ID_ROOT}.test`, learnsHam: 4, learnsSpam: 2 }],
        totalHam: 4,
        totalSpam: 2,
      });
      usersRepo.find.mockResolvedValue([{ email: `a@d${ID_ROOT}.test` }, { email: `b@d${ID_ROOT}.test` }]);
      const res = await api().get(url(ID_ROOT)).set("Authorization", auth(ROOT)).expect(200);
      expect(res.body.scanned).toBe(3);
      expect(res.body.actions.reject).toBe(1);
      expect(res.body.actions["no action"]).toBe(2);
      // Trained recipient ranks first; the untrained mailbox is folded in at 0.
      expect(res.body.bayes.recipients[0]).toMatchObject({ recipient: `b@d${ID_ROOT}.test`, learnsHam: 4 });
      expect(res.body.bayes.recipients).toHaveLength(2);
      expect(res.body.bayes.totalHam).toBe(4);
      expect(svc.history).toHaveBeenCalledWith(`d${ID_ROOT}.test`);
      expect(svc.domainBayes).toHaveBeenCalledWith(`d${ID_ROOT}.test`);
      expect(usersRepo.find).toHaveBeenCalledWith({ where: { domain: `d${ID_ROOT}.test` }, select: { email: true } });
    });
    it("200 for the domain owner (ownership bypass, no grant)", async () => {
      h.setDomainOwner(ID_OWNED, USER.id);
      svc.history.mockResolvedValue([]);
      svc.domainBayes.mockResolvedValue({ recipients: [], totalHam: 0, totalSpam: 0 });
      await api().get(url(ID_OWNED)).set("Authorization", auth(USER)).expect(200);
    });
    it("400 when :domainId is not an integer", async () => {
      await api().get(url("abc")).set("Authorization", auth(ROOT)).expect(400);
    });
  });

  // resolveFqdn's not-found path needs the VirtualDomain repo to return null,
  // which the shared harness never does (it is what backs setDomainOwner). A
  // dedicated harness overrides that repo; root bypasses the guard and reaches
  // resolveFqdn directly.
  describe("unknown domain", () => {
    let hnf: Harness;
    beforeAll(async () => {
      hnf = await buildHarness({
        controllers: [DomainsRspamdController],
        providers: [
          { provide: RspamdService, useValue: svc },
          { provide: getRepositoryToken(VirtualUser), useValue: usersRepo },
          { provide: getRepositoryToken(VirtualDomain), useValue: { findOne: vi.fn().mockResolvedValue(null) } },
        ],
      });
    });
    afterAll(() => hnf.close());

    it("404 for root on both routes when the domain does not exist", async () => {
      const server = hnf.app.getHttpServer();
      await request(server).get("/api/v1/domains/999/rspamd/stats").set("Authorization", `Bearer ${hnf.token(ROOT)}`).expect(404);
      await request(server).get("/api/v1/domains/999/rspamd/history").set("Authorization", `Bearer ${hnf.token(ROOT)}`).expect(404);
    });
  });
});
