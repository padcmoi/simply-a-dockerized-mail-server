import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DmarcRecordController } from "../../src/api/domains/dmarc-record/dmarc-record.controller";
import { DmarcRecordService } from "../../src/api/domains/dmarc-record/dmarc-record.service";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

describe("DmarcRecordController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const records = { describe: vi.fn() };
  const domainState = { ownerId: null as string | null, missing: false };
  const domainRepo = {
    findOne: vi.fn(async ({ where }: { where: { id: number } }) =>
      domainState.missing ? null : ({ id: where.id, domain: `d${where.id}.test`, ownerId: domainState.ownerId } as VirtualDomain)
    ),
  };
  const url = "/api/v1/domains/1/dmarc-record";

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [DmarcRecordController],
      providers: [
        { provide: DmarcRecordService, useValue: records },
        { provide: getRepositoryToken(VirtualDomain), useValue: domainRepo },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    vi.clearAllMocks();
    domainState.ownerId = null;
    domainState.missing = false;
    records.describe.mockResolvedValue({ dnsName: "_dmarc.d1.test", txtRecord: "v=DMARC1; p=none", reportsHere: false });
  });

  const api = () => request(h.app.getHttpServer());
  const auth = (u: typeof ROOT) => `Bearer ${h.token(u)}`;

  it("401 without a token", async () => {
    await api().get(url).expect(401);
  });

  it("401 with a garbage bearer token", async () => {
    await api().get(url).set("Authorization", "Bearer nope").expect(401);
  });

  it("403 for a user without any grant", async () => {
    await api().get(url).set("Authorization", auth(USER)).expect(403);
    expect(records.describe).not.toHaveBeenCalled();
  });

  it("403 for a user holding admin access but not view-admin-page on the domain", async () => {
    h.cpg.grantGlobal("domains", "access");
    h.cpg.grantDomain(1, "domain", "access");
    h.cpg.grantDomain(1, "admin", "access");
    await api().get(url).set("Authorization", auth(USER)).expect(403);
  });

  it("403 for a user granted the page on another domain", async () => {
    h.cpg.grantGlobal("domains", "access");
    h.cpg.grantDomain(2, "domain", "access");
    h.cpg.grantDomain(2, "admin", "access", "view-admin-page");
    await api().get(url).set("Authorization", auth(USER)).expect(403);
  });

  it("200 for a user granted admin access and view-admin-page on the domain", async () => {
    h.cpg.grantGlobal("domains", "access");
    h.cpg.grantDomain(1, "domain", "access");
    h.cpg.grantDomain(1, "admin", "access", "view-admin-page");
    const res = await api().get(url).set("Authorization", auth(USER)).expect(200);
    expect(res.body.dnsName).toBe("_dmarc.d1.test");
    expect(records.describe).toHaveBeenCalledWith("d1.test");
  });

  it("200 for the domain's owner", async () => {
    domainState.ownerId = USER.id;
    await api().get(url).set("Authorization", auth(USER)).expect(200);
  });

  it("200 for root", async () => {
    await api().get("/api/v1/domains/7/dmarc-record").set("Authorization", auth(ROOT)).expect(200);
    expect(records.describe).toHaveBeenCalledWith("d7.test");
  });

  it("404 for a domain that does not exist", async () => {
    domainState.missing = true;
    await api().get(url).set("Authorization", auth(ROOT)).expect(404);
  });

  it("400 for an id that is not a number", async () => {
    await api().get("/api/v1/domains/abc/dmarc-record").set("Authorization", auth(ROOT)).expect(400);
  });
});
