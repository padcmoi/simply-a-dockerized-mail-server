import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { LoginRiskController } from "../../src/api/config/login-risk.controller";
import { MAX_LOGIN_RADIUS_KM } from "../../src/api/config/login-risk.validation";
import { RootGuard } from "../../src/core/auth/root.guard";
import { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/login-risk";
const SETTINGS = { loginRadiusKm: 100, loginChallengeOrder: "email,question" };

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

  const routes: { name: string; send: (auth?: string) => request.Test }[] = [
    { name: "GET", send: (a) => attach(api().get(base), a) },
    { name: "PUT", send: (a) => attach(api().put(base).send(SETTINGS), a) },
  ];

  // Widening the radius is loosening what every account's sign-in has to prove:
  // it belongs to root alone, and no account permission reaches it.
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
    it("GET returns the radius and the order", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual(SETTINGS);
    });

    it("PUT stores the radius and the order together", async () => {
      const body = { loginRadiusKm: 250, loginChallengeOrder: "question,email" };
      await api().put(base).set("Authorization", root()).send(body).expect(200);
      expect(settings.update).toHaveBeenCalledWith(body);
    });
  });

  describe("validation (400)", () => {
    it.each([
      ["negative", -1],
      ["further than half the globe", MAX_LOGIN_RADIUS_KM + 1],
      ["fractional", 12.5],
    ])("rejects a radius %s", async (_case, value) => {
      await api()
        .put(base)
        .set("Authorization", root())
        .send({ ...SETTINGS, loginRadiusKm: value })
        .expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });

    // The authenticator app is never in the order: it comes first when the
    // account has one, and it is then the only thing asked.
    it.each([["an unknown method", "sms,email"], ["the app itself", "two-factor,email"], ["one method alone", "email"]])(
      "rejects an order naming %s",
      async (_case, value) => {
        await api()
          .put(base)
          .set("Authorization", root())
          .send({ ...SETTINGS, loginChallengeOrder: value })
          .expect(400);
        expect(settings.update).not.toHaveBeenCalled();
      }
    );

    it("accepts either of the two orders", async () => {
      for (const order of ["email,question", "question,email"]) {
        await api()
          .put(base)
          .set("Authorization", root())
          .send({ ...SETTINGS, loginChallengeOrder: order })
          .expect(200);
      }
    });

    // Zero is the way to turn the check off, not a mistake.
    it("accepts zero and both ends of the allowed range", async () => {
      for (const loginRadiusKm of [0, MAX_LOGIN_RADIUS_KM]) {
        await api()
          .put(base)
          .set("Authorization", root())
          .send({ ...SETTINGS, loginRadiusKm })
          .expect(200);
      }
    });

    it("rejects a missing field rather than storing NaN", async () => {
      await api().put(base).set("Authorization", root()).send({}).expect(400);
      expect(settings.update).not.toHaveBeenCalled();
    });
  });
});
