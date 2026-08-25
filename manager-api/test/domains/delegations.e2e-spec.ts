import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { DelegationsController } from "../../src/api/domains/delegations/delegations.controller";
import { DelegationsService } from "../../src/api/domains/delegations/delegations.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const DOMAIN_ID = 12;
const ACC = "11111111-1111-1111-1111-111111111111";
const base = `/api/v1/domains/${DOMAIN_ID}/delegations`;

type Method = "get" | "post" | "put" | "delete";

describe("DelegationsController (e2e: auth + ACL + behavior)", () => {
  let h: Harness;
  const svc = {
    listForDomain: vi.fn(),
    grantOrInvite: vi.fn(),
    createToken: vi.fn(),
    editInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    setCaps: vi.fn(),
    revoke: vi.fn(),
  };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [DelegationsController],
      providers: [{ provide: DelegationsService, useValue: svc }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => h.cpg.reset());

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  // The menu requires the existing creation actions on BOTH resources, plus the
  // domain access chain.
  const grant = () => {
    h.cpg.grantGlobal("domains", "access");
    h.cpg.grantDomain(DOMAIN_ID, "domain", "access");
    h.cpg.grantDomain(DOMAIN_ID, "recipients", "access", "create-recipient");
    h.cpg.grantDomain(DOMAIN_ID, "aliases", "access", "create-alias");
  };

  const inviteBody = { email: "new@x.io", maxRecipients: 5, maxAliases: null, quotaMb: 100, expiresDays: 7 };
  const tokenBody = { maxRecipients: 0, maxAliases: 0, quotaMb: 0, expiresDays: null, note: null };
  const capsBody = { maxRecipients: 0, maxAliases: 0, quotaMb: 0 };

  const routes: { name: string; method: Method; path: string; body?: object }[] = [
    { name: "GET list", method: "get", path: base },
    { name: "POST invite", method: "post", path: `${base}/invite`, body: inviteBody },
    { name: "POST token", method: "post", path: `${base}/token`, body: tokenBody },
    { name: "PUT invitation", method: "put", path: `${base}/invitations/9`, body: tokenBody },
    { name: "DELETE invitation", method: "delete", path: `${base}/invitations/9` },
    { name: "PUT caps", method: "put", path: `${base}/${ACC}`, body: capsBody },
    { name: "DELETE revoke", method: "delete", path: `${base}/${ACC}` },
  ];

  const call = (m: Method, path: string, body?: object) => {
    const req =
      m === "get" ? api().get(path) : m === "post" ? api().post(path) : m === "put" ? api().put(path) : api().delete(path);
    return body ? req.send(body) : req;
  };

  describe("auth (401) + ACL (403)", () => {
    for (const r of routes) {
      it(`401 without a token -- ${r.name}`, async () => {
        await call(r.method, r.path, r.body).expect(401);
      });
      it(`403 for a user without any grant -- ${r.name}`, async () => {
        await call(r.method, r.path, r.body).set("Authorization", user()).expect(403);
      });
    }

    it("403 when only the recipients side is granted (aliases side missing)", async () => {
      h.cpg.grantGlobal("domains", "access");
      h.cpg.grantDomain(DOMAIN_ID, "domain", "access");
      h.cpg.grantDomain(DOMAIN_ID, "recipients", "access", "create-recipient");
      await api().get(base).set("Authorization", user()).expect(403);
    });

    it("200 for a non-root user granted the full chain", async () => {
      grant();
      svc.listForDomain.mockResolvedValueOnce({ delegations: [], pendingInvitations: [] });
      await api().get(base).set("Authorization", user()).expect(200);
    });

    it("200 for the domain owner without any grant (ownership bypass)", async () => {
      h.setDomainOwner(DOMAIN_ID, USER.id);
      svc.listForDomain.mockResolvedValueOnce({ delegations: [], pendingInvitations: [] });
      await api().get(base).set("Authorization", user()).expect(200);
    });

    it("200 for root regardless of grants", async () => {
      svc.listForDomain.mockResolvedValueOnce({ delegations: [], pendingInvitations: [] });
      await api().get(base).set("Authorization", root()).expect(200);
    });
  });

  describe("POST /invite", () => {
    it("forwards the caller, domain and parsed body", async () => {
      svc.grantOrInvite.mockResolvedValueOnce({ mode: "invited", email: "new@x.io" });
      await api().post(`${base}/invite`).set("Authorization", root()).send(inviteBody).expect(201);
      expect(svc.grantOrInvite).toHaveBeenCalledWith(ROOT.id, DOMAIN_ID, inviteBody, expect.stringContaining("http"));
    });

    it("400 on a missing email and on an unknown field (strict)", async () => {
      await api().post(`${base}/invite`).set("Authorization", root()).send(capsBody).expect(400);
      await api()
        .post(`${base}/invite`)
        .set("Authorization", root())
        .send({ ...inviteBody, nope: 1 })
        .expect(400);
      expect(svc.grantOrInvite).not.toHaveBeenCalled();
    });
  });

  describe("POST /token", () => {
    it("forwards the caller, domain and caps (null expiry = stands until revoked), returns the link", async () => {
      svc.createToken.mockResolvedValueOnce({ token: "t", link: "http://x/invite/t" });
      const res = await api().post(`${base}/token`).set("Authorization", root()).send(tokenBody).expect(201);
      expect(res.body).toEqual({ token: "t", link: "http://x/invite/t" });
      expect(svc.createToken).toHaveBeenCalledWith(ROOT.id, DOMAIN_ID, tokenBody, expect.stringContaining("http"));
    });

    it("400 on a negative cap and on a missing expiresDays", async () => {
      await api()
        .post(`${base}/token`)
        .set("Authorization", root())
        .send({ ...tokenBody, maxRecipients: -1 })
        .expect(400);
      await api().post(`${base}/token`).set("Authorization", root()).send(capsBody).expect(400);
      expect(svc.createToken).not.toHaveBeenCalled();
    });
  });

  describe("PUT /invitations/:invitationId", () => {
    it("forwards domain, invitation id and the parsed caps + expiry", async () => {
      svc.editInvitation.mockResolvedValueOnce({ ok: true });
      await api().put(`${base}/invitations/9`).set("Authorization", root()).send(tokenBody).expect(200);
      expect(svc.editInvitation).toHaveBeenCalledWith(DOMAIN_ID, 9, tokenBody);
    });
  });

  describe("DELETE /invitations/:invitationId", () => {
    it("forwards domain and invitation id", async () => {
      svc.revokeInvitation.mockResolvedValueOnce({ ok: true });
      await api().delete(`${base}/invitations/9`).set("Authorization", root()).expect(200);
      expect(svc.revokeInvitation).toHaveBeenCalledWith(DOMAIN_ID, 9);
    });
  });

  describe("PUT /:accountId", () => {
    it("forwards the parsed caps (zeros = full restriction pass validation)", async () => {
      svc.setCaps.mockResolvedValueOnce({});
      await api().put(`${base}/${ACC}`).set("Authorization", root()).send(capsBody).expect(200);
      expect(svc.setCaps).toHaveBeenCalledWith(DOMAIN_ID, ACC, capsBody);
    });

    it("400 when :accountId is not a uuid", async () => {
      await api().put(`${base}/nope`).set("Authorization", root()).send(capsBody).expect(400);
      expect(svc.setCaps).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /:accountId", () => {
    it("forwards domain and account", async () => {
      svc.revoke.mockResolvedValueOnce({ ok: true });
      await api().delete(`${base}/${ACC}`).set("Authorization", root()).expect(200);
      expect(svc.revoke).toHaveBeenCalledWith(DOMAIN_ID, ACC);
    });
  });

  it("400 when :domainId is not an integer", async () => {
    await api().get("/api/v1/domains/abc/delegations").set("Authorization", root()).expect(400);
  });
});
