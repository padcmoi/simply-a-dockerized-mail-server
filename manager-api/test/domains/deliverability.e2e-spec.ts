import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DeliverabilityController } from "../../src/api/domains/deliverability/deliverability.controller";
import { DeliverabilityService } from "../../src/api/domains/deliverability/deliverability.service";
import { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";
import { entity, repoMock } from "../helpers/mocks";

const base = "/api/v1/domains/1/deliverability";

describe("DeliverabilityController (e2e: auth + ACL)", () => {
  let h: Harness;
  const svc = { report: vi.fn() };
  const domains = repoMock<VirtualDomain>();

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [DeliverabilityController],
      providers: [
        { provide: DeliverabilityService, useValue: svc },
        { provide: getRepositoryToken(VirtualDomain), useValue: domains },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    svc.report.mockReset().mockResolvedValue({ domain: "example.org", checks: [] });
    domains.findOne.mockReset().mockResolvedValue(entity<VirtualDomain>({ id: 1, domain: "Example.ORG" }));
  });

  const api = () => request(h.app.getHttpServer());

  it("401 without a token", async () => {
    await api().get(base).expect(401);
  });

  it("403 for an account holding nothing", async () => {
    await api().get(base).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    expect(svc.report).not.toHaveBeenCalled();
  });

  // Access to the domain is not the right to spend a run: the global
  // permission is a separate gate, and reaching the domain without it fails.
  it("403 with access to the domain but no right to run diagnostics", async () => {
    h.cpg.grantGlobal("domains", "access");
    h.cpg.grantDomain(1, "domain", "access");
    await api().get(base).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    expect(svc.report).not.toHaveBeenCalled();
  });

  // And the converse: holding the global right does not open a domain the
  // account cannot see.
  it("403 with the right to run diagnostics but no access to the domain", async () => {
    h.cpg.grantGlobal("deliverability", "access", "run-diagnostics");
    await api().get(base).set("Authorization", `Bearer ${h.token(USER)}`).expect(403);
    expect(svc.report).not.toHaveBeenCalled();
  });

  it("200 once both gates are held", async () => {
    h.cpg.grantGlobal("domains", "access");
    h.cpg.grantGlobal("deliverability", "access", "run-diagnostics");
    h.cpg.grantDomain(1, "domain", "access");
    await api().get(base).set("Authorization", `Bearer ${h.token(USER)}`).expect(200);
  });

  it("runs against the domain's canonical lowercase name", async () => {
    await api().get(base).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
    expect(svc.report).toHaveBeenCalledWith("example.org", false);
  });

  it("404 on a domain that does not exist", async () => {
    domains.findOne.mockResolvedValue(null);
    await api().get(base).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(404);
    expect(svc.report).not.toHaveBeenCalled();
  });

  // Opening the page reads the stored report; the re-run button is the only
  // thing that spends an SMTP session and a round of blocklist queries.
  it("only produces a new report when the caller asks for one", async () => {
    await api().get(`${base}?refresh=true`).set("Authorization", `Bearer ${h.token(ROOT)}`).expect(200);
    expect(svc.report).toHaveBeenCalledWith("example.org", true);
  });

  it("400 on a non-numeric domain id", async () => {
    await api().get("/api/v1/domains/abc/deliverability").set("Authorization", `Bearer ${h.token(ROOT)}`).expect(400);
  });
});
