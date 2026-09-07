import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { LoginRiskController } from "../../src/api/config/login-risk.controller";
import {
  MAX_GEOIP_CACHE_DAYS,
  MAX_LOGIN_ADDRESS_DAYS,
  MAX_LOGIN_NETWORK_DAYS,
  MAX_LOGIN_RADIUS_KM,
} from "../../src/api/config/login-risk.validation";
import { RootGuard } from "../../src/core/auth/root.guard";
import { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/login-risk";
const SETTINGS = {
  loginRadiusKm: 100,
  loginChallengeOrder: "email,question",
  loginChallengeExclusive: false,
  geoipCacheDays: 90,
  loginAddressDays: 30,
  loginNetworkDays: 180,
};

describe("LoginRiskController (e2e: root-only /config namespace)", () => {
  let h: Harness;
  const settings = { get: vi.fn(), update: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [LoginRiskController],
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
  const put = (body: Record<string, unknown>) => api().put(base).set("Authorization", root()).send(body);

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

    it("403 for an account holding every account permission there is", async () => {
      h.cpg.grantGlobal("accounts", "access", "edit-account", "view-account");
      await api().get(base).set("Authorization", user()).expect(403);
    });
  });

  describe("as root", () => {
    it("GET returns the radius, the order, the exclusivity and the three durations", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual(SETTINGS);
    });

    it("PUT stores every field together", async () => {
      const body = {
        loginRadiusKm: 250,
        loginChallengeOrder: "question,email",
        loginChallengeExclusive: true,
        geoipCacheDays: 45,
        loginAddressDays: 15,
        loginNetworkDays: 365,
      };
      await put(body).expect(200);
      expect(settings.update).toHaveBeenCalledWith(body);
    });
  });

  describe("validation (400)", () => {
    it.each([
      ["negative", -1],
      ["further than half the globe", MAX_LOGIN_RADIUS_KM + 1],
      ["fractional", 12.5],
    ])("rejects a radius %s", async (_case, value) => {
      await put({ ...SETTINGS, loginRadiusKm: value }).expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });

    it.each([
      ["an unknown method", "sms,email"],
      ["the app itself", "two-factor,email"],
      ["one method alone", "email"],
    ])("rejects an order naming %s", async (_case, value) => {
      await put({ ...SETTINGS, loginChallengeOrder: value }).expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });

    it("accepts either of the two orders", async () => {
      for (const order of ["email,question", "question,email"]) {
        await put({ ...SETTINGS, loginChallengeOrder: order }).expect(200);
      }
    });

    it("rejects an exclusivity that is not a boolean", async () => {
      for (const value of ["yes", 1, null]) {
        await put({ ...SETTINGS, loginChallengeExclusive: value }).expect(400);
      }
      expect(settings.update).not.toHaveBeenCalled();
    });

    it.each([
      ["geoipCacheDays", MAX_GEOIP_CACHE_DAYS],
      ["loginAddressDays", MAX_LOGIN_ADDRESS_DAYS],
      ["loginNetworkDays", MAX_LOGIN_NETWORK_DAYS],
    ])("keeps %s between one day and its ceiling", async (field, max) => {
      for (const value of [0, max + 1, 1.5]) {
        await put({ ...SETTINGS, [field]: value }).expect(400);
      }
      expect(settings.update).not.toHaveBeenCalled();
      for (const value of [1, max]) {
        await put({ ...SETTINGS, [field]: value }).expect(200);
      }
    });

    it("accepts zero and both ends of the allowed range", async () => {
      for (const loginRadiusKm of [0, MAX_LOGIN_RADIUS_KM]) {
        await put({ ...SETTINGS, loginRadiusKm }).expect(200);
      }
    });

    it("rejects a missing field rather than storing NaN", async () => {
      await put({}).expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });
  });
});
