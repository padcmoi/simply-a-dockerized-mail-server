import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { MailConfigController } from "../../src/api/config/mail-config.controller";
import { RootGuard } from "../../src/core/auth/root.guard";
import { MailSettingsService } from "../../src/core/mailer/mail-settings.service";
import { MailerService } from "../../src/core/mailer/mailer.service";
import { ApiError } from "../../src/core/common/api-error";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/config/mail";
const ENABLED = { enabled: true, provider: "brevo", host: "smtp-relay.brevo.com", port: 587, secure: false };

describe("MailConfigController (e2e: root-only /config namespace)", () => {
  let h: Harness;
  const settings = {
    list: vi.fn(),
    save: vi.fn(),
    configFor: vi.fn(),
    setOtp: vi.fn(),
    verify: vi.fn(),
    select: vi.fn(),
    disable: vi.fn(),
  };
  const mailer = { sendWith: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [MailConfigController],
      providers: [RootGuard, { provide: MailSettingsService, useValue: settings }, { provide: MailerService, useValue: mailer }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    settings.list.mockReset().mockResolvedValue({ configs: [], selected: null });
    settings.save.mockReset().mockResolvedValue({ provider: "brevo", hasPassword: true, validated: false });
    settings.configFor.mockReset().mockResolvedValue(ENABLED);
    settings.setOtp.mockReset().mockResolvedValue(undefined);
    settings.verify.mockReset().mockResolvedValue(true);
    settings.select.mockReset().mockResolvedValue(true);
    settings.disable.mockReset().mockResolvedValue(undefined);
    mailer.sendWith.mockReset().mockResolvedValue(undefined);
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const attach = (t: request.Test, auth?: string) => (auth ? t.set("Authorization", auth) : t);

  const routes: { name: string; send: (auth?: string) => request.Test }[] = [
    { name: "GET", send: (a) => attach(api().get(base), a) },
    { name: "PUT", send: (a) => attach(api().put(base).send({ provider: "brevo", username: "u", fromAddress: "a@b.test" }), a) },
    { name: "POST test", send: (a) => attach(api().post(`${base}/test`).send({ provider: "brevo" }), a) },
    { name: "POST verify", send: (a) => attach(api().post(`${base}/verify`).send({ provider: "brevo", otp: "123456" }), a) },
    { name: "POST select", send: (a) => attach(api().post(`${base}/select`).send({ provider: "brevo" }), a) },
    { name: "POST disable", send: (a) => attach(api().post(`${base}/disable`), a) },
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
    it("GET returns the config list", async () => {
      settings.list.mockResolvedValue({ configs: [{ provider: "brevo", validated: true }], selected: "brevo" });
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual({ configs: [{ provider: "brevo", validated: true }], selected: "brevo" });
    });

    it("PUT saves one provider's config", async () => {
      await api()
        .put(base)
        .set("Authorization", root())
        .send({ provider: "brevo", username: "u", password: "k", fromAddress: "a@b.test" })
        .expect(200);
      expect(settings.save).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "brevo", username: "u", password: "k", fromAddress: "a@b.test" })
      );
    });

    it("POST test emails a 6-digit code through the provider config and stores it", async () => {
      await api().post(`${base}/test`).set("Authorization", root()).send({ provider: "brevo" }).expect(201);
      expect(settings.configFor).toHaveBeenCalledWith("brevo");
      expect(mailer.sendWith).toHaveBeenCalledWith(ENABLED, expect.objectContaining({ to: ROOT.email }));
      const storedCode = settings.setOtp.mock.calls[0][1] as string;
      expect(storedCode).toMatch(/^\d{6}$/);
    });

    it("POST test surfaces a send failure as 502, storing no code", async () => {
      mailer.sendWith.mockRejectedValueOnce(
        new ApiError(HttpStatus.BAD_GATEWAY, "mail.sendFailed", "auth failed", { detail: "auth failed" })
      );
      const res = await api().post(`${base}/test`).set("Authorization", root()).send({ provider: "brevo" }).expect(502);
      expect(res.body.code).toBe("mail.sendFailed");
      expect(settings.setOtp).not.toHaveBeenCalled();
    });

    it("POST verify validates and activates on the right code", async () => {
      await api().post(`${base}/verify`).set("Authorization", root()).send({ provider: "brevo", otp: "123456" }).expect(201);
      expect(settings.verify).toHaveBeenCalledWith("brevo", "123456");
    });

    it("POST verify rejects a wrong code with mail.otpInvalid", async () => {
      settings.verify.mockResolvedValue(false);
      const res = await api()
        .post(`${base}/verify`)
        .set("Authorization", root())
        .send({ provider: "brevo", otp: "000000" })
        .expect(400);
      expect(res.body.code).toBe("mail.otpInvalid");
    });

    it("POST select activates an already-validated provider, no code", async () => {
      await api().post(`${base}/select`).set("Authorization", root()).send({ provider: "smtp" }).expect(201);
      expect(settings.select).toHaveBeenCalledWith("smtp");
    });

    it("POST disable turns mail off", async () => {
      await api().post(`${base}/disable`).set("Authorization", root()).expect(201);
      expect(settings.disable).toHaveBeenCalled();
    });
  });

  describe("validation (400)", () => {
    it("PUT rejects an unknown or empty provider", async () => {
      await api().put(base).set("Authorization", root()).send({ provider: "" }).expect(400);
      await api().put(base).set("Authorization", root()).send({ provider: "sendmail" }).expect(400);
    });
    it("PUT brevo requires username + sender; smtp requires host", async () => {
      await api().put(base).set("Authorization", root()).send({ provider: "brevo" }).expect(400);
      await api().put(base).set("Authorization", root()).send({ provider: "smtp" }).expect(400);
      await api().put(base).set("Authorization", root()).send({ provider: "smtp", host: "mail-postfix" }).expect(200);
    });
    it("PUT strips unknown keys", async () => {
      await api().put(base).set("Authorization", root()).send({ provider: "smtp", host: "h", surprise: 1 }).expect(200);
    });
    it("verify requires a 6-digit code", async () => {
      await api().post(`${base}/verify`).set("Authorization", root()).send({ provider: "brevo", otp: "12" }).expect(400);
    });
    it("test and select reject an unknown provider", async () => {
      await api().post(`${base}/test`).set("Authorization", root()).send({ provider: "nope" }).expect(400);
      await api().post(`${base}/select`).set("Authorization", root()).send({ provider: "nope" }).expect(400);
    });
  });
});
