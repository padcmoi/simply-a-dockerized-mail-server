import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { HttpStatus } from "@nestjs/common";
import { PostfixConfigController } from "../../src/api/config/postfix-config.controller";
import { ActivityLogService } from "../../src/core/activity/activity-log.service";
import { RootGuard } from "../../src/core/auth/root.guard";
import { ApiError } from "../../src/core/common/api-error";
import { PostfixSettingsService } from "../../src/core/postfix/postfix-settings.service";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/postfix";
const SETTINGS = {
  bounceSenderLocal: "mailer-daemon",
  bounceSenderDomain: "example.com",
  delayWarningHours: 4,
  maximalQueueLifetimeDays: 3,
};
const VIEW = {
  settings: SETTINGS,
  version: 1,
  hostname: "mail.example.com",
  domains: ["example.com"],
  status: { state: "applied", appliedVersion: 1, appliedAt: null, checkedAt: null, error: null },
};

describe("PostfixConfigController (e2e: root-only /config namespace)", () => {
  let h: Harness;
  const postfix = { get: vi.fn(), update: vi.fn() };
  const activity = { record: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [PostfixConfigController],
      providers: [
        RootGuard,
        { provide: PostfixSettingsService, useValue: postfix },
        { provide: ActivityLogService, useValue: activity },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    postfix.get.mockReset().mockResolvedValue(VIEW);
    postfix.update.mockReset().mockResolvedValue({ view: VIEW, changed: ["bounceSenderDomain"] });
    activity.record.mockReset().mockResolvedValue(undefined);
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
        expect(postfix.get).not.toHaveBeenCalled();
        expect(postfix.update).not.toHaveBeenCalled();
      });
    }
  });

  describe("as root", () => {
    it("GET returns the settings and their apply status", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual(VIEW);
    });

    it("PUT updates them and records the change", async () => {
      await put(SETTINGS).expect(200);
      expect(postfix.update).toHaveBeenCalledWith(SETTINGS);
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "postfix.settings-updated",
          details: expect.objectContaining({ fields: ["bounceSenderDomain"] }),
        })
      );
    });

    it("PUT with nothing changed records nothing", async () => {
      postfix.update.mockResolvedValue({ view: VIEW, changed: [] });
      await put(SETTINGS).expect(200);
      expect(activity.record).not.toHaveBeenCalled();
    });

    it("PUT relays a domain that is not hosted here as a 400", async () => {
      postfix.update.mockRejectedValue(
        new ApiError(
          HttpStatus.BAD_REQUEST,
          "postfix.domainNotHosted",
          "microsoft.com is not an active domain hosted on this server",
          {
            domain: "microsoft.com",
          }
        )
      );
      const res = await put({ ...SETTINGS, bounceSenderDomain: "microsoft.com" }).expect(400);
      expect(res.body.code).toBe("postfix.domainNotHosted");
    });
  });

  describe("validation (400)", () => {
    const invalid: [string, Record<string, unknown>][] = [
      ["an uppercase local part", { ...SETTINGS, bounceSenderLocal: "MAILER-DAEMON" }],
      ["a local part with a space", { ...SETTINGS, bounceSenderLocal: "mailer daemon" }],
      ["a local part starting with a dot", { ...SETTINGS, bounceSenderLocal: ".mailer" }],
      ["a local part with two dots in a row", { ...SETTINGS, bounceSenderLocal: "mailer..daemon" }],
      ["a local part over 64 characters", { ...SETTINGS, bounceSenderLocal: "a".repeat(65) }],
      ["a domain that is not a domain", { ...SETTINGS, bounceSenderDomain: "not a domain" }],
      ["a domain without a dot", { ...SETTINGS, bounceSenderDomain: "localhost" }],
      ["a bounce language, English being the only text", { ...SETTINGS, bounceLanguage: "fr" }],
      ["a delay warning over 24 hours", { ...SETTINGS, delayWarningHours: 25 }],
      ["a negative delay warning", { ...SETTINGS, delayWarningHours: -1 }],
      ["a fractional delay warning", { ...SETTINGS, delayWarningHours: 1.5 }],
      ["a queue lifetime of 0 days", { ...SETTINGS, maximalQueueLifetimeDays: 0 }],
      ["a queue lifetime over 5 days", { ...SETTINGS, maximalQueueLifetimeDays: 6 }],
      ["a delay warning not before the give-up", { ...SETTINGS, delayWarningHours: 24, maximalQueueLifetimeDays: 1 }],
      ["a missing field", { ...SETTINGS, delayWarningHours: undefined }],
      ["a free Postfix parameter", { ...SETTINGS, myhostname: "evil.example.com" }],
    ];
    for (const [name, body] of invalid) {
      it(`rejects ${name}`, async () => {
        await put(body).expect(400);
        expect(postfix.update).not.toHaveBeenCalled();
      });
    }

    it("accepts an empty domain, the default sender", async () => {
      await put({ ...SETTINGS, bounceSenderDomain: "" }).expect(200);
    });
  });
});
