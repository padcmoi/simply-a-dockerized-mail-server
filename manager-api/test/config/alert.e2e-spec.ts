import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { AlertController } from "../../src/api/config/alert.controller";
import { RootGuard } from "../../src/core/auth/root.guard";
import { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/alert";

describe("AlertController (e2e: root-only /config namespace)", () => {
  let h: Harness;
  const settings = { get: vi.fn(), update: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [AlertController],
      providers: [RootGuard, { provide: AppSettingsService, useValue: settings }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    settings.get.mockReset().mockReturnValue({ adminAlertEmail: "admin@example.com", managerUrl: "https://example.com" });
    settings.update.mockReset().mockImplementation(async (body: { adminAlertEmail: string }) => ({
      adminAlertEmail: body.adminAlertEmail,
      managerUrl: "https://example.com",
    }));
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const attach = (t: request.Test, auth?: string) => (auth ? t.set("Authorization", auth) : t);

  const routes: { name: string; send: (auth?: string) => request.Test }[] = [
    { name: "GET", send: (a) => attach(api().get(base), a) },
    { name: "PUT", send: (a) => attach(api().put(base).send({ adminAlertEmail: "admin@example.com" }), a) },
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
    it("403 for a non-root account holding every global permission", async () => {
      h.cpg.grantGlobal("misc", "access", "protect-resource");
      h.cpg.grantGlobal("supervision", "access", "view-machine-metrics");
      await api().put(base).set("Authorization", user()).send({ adminAlertEmail: "admin@example.com" }).expect(403);
      expect(settings.update).not.toHaveBeenCalled();
    });
  });

  describe("as root", () => {
    it("GET returns the alert address and nothing else", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual({ adminAlertEmail: "admin@example.com" });
    });

    it("PUT stores the address trimmed and in lower case", async () => {
      const res = await api()
        .put(base)
        .set("Authorization", root())
        .send({ adminAlertEmail: "  Admin@Example.COM " })
        .expect(200);
      expect(settings.update).toHaveBeenCalledWith({ adminAlertEmail: "admin@example.com" });
      expect(res.body).toEqual({ adminAlertEmail: "admin@example.com" });
    });

    it("PUT stores an empty address, which alerts nobody", async () => {
      const res = await api().put(base).set("Authorization", root()).send({ adminAlertEmail: "" }).expect(200);
      expect(settings.update).toHaveBeenCalledWith({ adminAlertEmail: "" });
      expect(res.body).toEqual({ adminAlertEmail: "" });
    });

    it("PUT forwards no other setting", async () => {
      await api()
        .put(base)
        .set("Authorization", root())
        .send({ adminAlertEmail: "admin@example.com", managerUrl: "https://evil.example.com" })
        .expect(200);
      expect(settings.update).toHaveBeenCalledWith({ adminAlertEmail: "admin@example.com" });
    });
  });

  describe("validation (400)", () => {
    const rejected: unknown[] = [
      "not an address",
      "admin@",
      "@example.com",
      "admin@example",
      "a@b.com, c@d.com",
      "admin@example.com\nBcc: x@y.com",
      `${"a".repeat(250)}@example.com`,
      42,
      null,
    ];
    for (const value of rejected) {
      it(`rejects ${JSON.stringify(value)}`, async () => {
        await api().put(base).set("Authorization", root()).send({ adminAlertEmail: value }).expect(400);
        expect(settings.update).not.toHaveBeenCalled();
      });
    }
    it("rejects a body without the address", async () => {
      await api().put(base).set("Authorization", root()).send({}).expect(400);
    });
  });
});
