import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { GeneralController } from "../../src/api/config/general.controller";
import { RootGuard } from "../../src/core/auth/root.guard";
import { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/general";

describe("GeneralController (e2e: root-only /config namespace)", () => {
  let h: Harness;
  const settings = { get: vi.fn(), update: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [GeneralController],
      providers: [RootGuard, { provide: AppSettingsService, useValue: settings }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    settings.get.mockReset().mockReturnValue({ managerUrl: "https://example.com" });
    settings.update.mockReset().mockResolvedValue({ managerUrl: "https://example.com" });
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const attach = (t: request.Test, auth?: string) => (auth ? t.set("Authorization", auth) : t);

  const routes: { name: string; send: (auth?: string) => request.Test }[] = [
    { name: "GET", send: (a) => attach(api().get(base), a) },
    { name: "GET tlds", send: (a) => attach(api().get(`${base}/tlds`), a) },
    { name: "PUT", send: (a) => attach(api().put(base).send({ managerUrl: "https://example.com" }), a) },
  ];

  describe("root-only guard", () => {
    for (const r of routes) {
      it(`401 without a token -- ${r.name}`, async () => {
        await r.send().expect(401);
      });
      it(`403 for a non-root account -- ${r.name}`, async () => {
        await r.send(user()).expect(403);
      });
    }
  });

  describe("as root", () => {
    it("GET returns the interface address", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual({ managerUrl: "https://example.com" });
    });

    it("GET tlds returns the IANA catalogue", async () => {
      const res = await api().get(`${base}/tlds`).set("Authorization", root()).expect(200);
      expect(Array.isArray(res.body.tlds)).toBe(true);
      expect(res.body.tlds).toContain("ovh");
      expect(res.body.tlds).toContain("com");
      expect(res.body.tlds).not.toContain("gestionpartique");
    });

    it("PUT stores the interface address", async () => {
      await api().put(base).set("Authorization", root()).send({ managerUrl: "https://mail-manager.example.com" }).expect(200);
      expect(settings.update).toHaveBeenCalledWith({ managerUrl: "https://mail-manager.example.com" });
    });
  });

  describe("real-domain validation (400)", () => {
    const rejected = [
      "not a url",
      "ftp://example.com",
      "https://example.com/path",
      "https://example.com/",
      "https://example.com?q=1",
      "https://example.com#f",
      "example.com",
      "https://host",
      "https://localhost",
      "https://localhost:3000",
      "https://1.2.3.4",
      "https://mail.gestionpartique",
      "https://foo.notarealtld",
    ];
    for (const value of rejected) {
      it(`rejects ${JSON.stringify(value)}`, async () => {
        await api().put(base).set("Authorization", root()).send({ managerUrl: value }).expect(400);
      });
    }

    const accepted = ["", "https://mail-manager.gestionpratique.ovh", "http://example.com", "https://a.b.example.co.uk:8443"];
    for (const value of accepted) {
      it(`accepts ${JSON.stringify(value)}`, async () => {
        await api().put(base).set("Authorization", root()).send({ managerUrl: value }).expect(200);
      });
    }
  });
});
