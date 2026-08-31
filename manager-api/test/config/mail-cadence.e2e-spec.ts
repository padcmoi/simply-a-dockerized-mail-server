import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { MailCadenceController } from "../../src/api/config/mail-cadence.controller";
import { RootGuard } from "../../src/core/auth/root.guard";
import { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/mail-cadence";
const SETTINGS = { offlineNotifyAfterMs: 300000, offlineSweepIntervalMs: 20000, mailMinIntervalMs: 30000 };

describe("MailCadenceController (e2e: root-only /config namespace)", () => {
  let h: Harness;
  const settings = { get: vi.fn(), update: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [MailCadenceController],
      providers: [RootGuard, { provide: AppSettingsService, useValue: settings }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    settings.get.mockReset().mockReturnValue(SETTINGS);
    settings.update.mockReset().mockResolvedValue(SETTINGS);
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const attach = (t: request.Test, auth?: string) => (auth ? t.set("Authorization", auth) : t);

  const routes: { name: string; send: (auth?: string) => request.Test }[] = [
    { name: "GET", send: (a) => attach(api().get(base), a) },
    { name: "PUT", send: (a) => attach(api().put(base).send(SETTINGS), a) },
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
    it("GET returns the cadence settings", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual(SETTINGS);
    });

    it("PUT updates them", async () => {
      const body = { offlineNotifyAfterMs: 60000, offlineSweepIntervalMs: 15000, mailMinIntervalMs: 10000 };
      await api().put(base).set("Authorization", root()).send(body).expect(200);
      expect(settings.update).toHaveBeenCalledWith(body);
    });
  });

  describe("validation (400)", () => {
    it("rejects an out-of-range value", async () => {
      await api()
        .put(base)
        .set("Authorization", root())
        .send({ offlineNotifyAfterMs: 1, offlineSweepIntervalMs: 20000, mailMinIntervalMs: 30000 })
        .expect(400);
    });
    it("rejects a missing field", async () => {
      await api().put(base).set("Authorization", root()).send({ offlineNotifyAfterMs: 300000, offlineSweepIntervalMs: 20000 }).expect(400);
    });
    it("rejects an anti-spam window longer than the notification delay", async () => {
      await api()
        .put(base)
        .set("Authorization", root())
        .send({ offlineNotifyAfterMs: 60000, offlineSweepIntervalMs: 20000, mailMinIntervalMs: 61000 })
        .expect(400);
    });
    it("rejects a check frequency longer than the notification delay", async () => {
      await api()
        .put(base)
        .set("Authorization", root())
        .send({ offlineNotifyAfterMs: 60000, offlineSweepIntervalMs: 61000, mailMinIntervalMs: 30000 })
        .expect(400);
    });
  });
});
