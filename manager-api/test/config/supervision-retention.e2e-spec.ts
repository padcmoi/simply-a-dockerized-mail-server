import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { SupervisionRetentionController } from "../../src/api/config/supervision-retention.controller";
import { MAX_RETENTION_MS, MIN_RETENTION_MS } from "../../src/api/config/supervision-retention.validation";
import { RootGuard } from "../../src/core/auth/root.guard";
import { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/supervision";
const MONTH = 30 * 86_400_000;
const SETTINGS = { supervisionRetentionMs: MONTH };

describe("SupervisionRetentionController (e2e: root-only /config namespace)", () => {
  let h: Harness;
  const settings = { get: vi.fn(), update: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [SupervisionRetentionController],
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

  // How long a machine's history is kept is a server-wide decision, not one the
  // supervision permission carries: this namespace is root and nothing else.
  describe("root-only guard", () => {
    for (const r of routes) {
      it(`401 without a token -- ${r.name}`, async () => {
        await r.send().expect(401);
      });
      it(`403 for a non-root account -- ${r.name}`, async () => {
        await r.send(user()).expect(403);
      });
    }

    it("403 for an account holding every supervision permission there is", async () => {
      h.cpg.grantGlobal("supervision", "access", "view-machine-metrics", "view-metrics-history");
      await api().get(base).set("Authorization", user()).expect(403);
    });
  });

  describe("as root", () => {
    it("GET returns the retention", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual(SETTINGS);
    });

    it("PUT updates it", async () => {
      const body = { supervisionRetentionMs: 7 * 86_400_000 };
      await api().put(base).set("Authorization", root()).send(body).expect(200);
      expect(settings.update).toHaveBeenCalledWith(body);
    });
  });

  describe("validation (400)", () => {
    it.each([
      ["shorter than a day", MIN_RETENTION_MS - 1],
      ["longer than a year", MAX_RETENTION_MS + 1],
      ["zero", 0],
      ["negative", -1],
    ])("rejects a retention %s", async (_case, value) => {
      await api().put(base).set("Authorization", root()).send({ supervisionRetentionMs: value }).expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });

    it("accepts both ends of the allowed range", async () => {
      await api().put(base).set("Authorization", root()).send({ supervisionRetentionMs: MIN_RETENTION_MS }).expect(200);
      await api().put(base).set("Authorization", root()).send({ supervisionRetentionMs: MAX_RETENTION_MS }).expect(200);
    });

    it("rejects a missing field rather than storing NaN", async () => {
      await api().put(base).set("Authorization", root()).send({}).expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });
  });
});
