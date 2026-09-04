import { describe, it, expect, beforeEach, vi } from "vitest";
import { HttpStatus, Logger } from "@nestjs/common";
import type { MailConfig } from "../../src/core/mailer/providers";
import type { MailSettingsService } from "../../src/core/mailer/mail-settings.service";
import type { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { ApiError } from "../../src/core/common/api-error";
import { providerMock, type Loose } from "../helpers/mocks";

const appSettings = providerMock<AppSettingsService>({
  get: vi.fn().mockReturnValue({ offlineNotifyAfterMs: 300000, offlineSweepIntervalMs: 20000, mailMinIntervalMs: 30000 }),
});

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn((_opts?: unknown) => ({ sendMail }));
  return { sendMail, createTransport };
});
vi.mock("nodemailer", () => ({ createTransport, default: { createTransport } }));

import { MailerService } from "../../src/core/mailer/mailer.service";

vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

const OFF: MailConfig = { enabled: false, provider: null, host: "", port: 587, secure: false };
const SMTP: MailConfig = { enabled: true, provider: "smtp", host: "mail-postfix", port: 25, secure: false };
const BREVO: MailConfig = {
  enabled: true,
  provider: "brevo",
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: { user: "u", pass: "k" },
  from: "s@d.test",
};

describe("MailerService", () => {
  let settings: Loose<MailSettingsService>;
  let svc: MailerService;

  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: "id" });
    createTransport.mockClear();
    settings = providerMock<MailSettingsService>({ toConfig: vi.fn().mockResolvedValue(SMTP), isEnabled: vi.fn() });
    svc = new MailerService(settings, appSettings);
  });

  it("isEnabled delegates to the settings service", async () => {
    settings.isEnabled.mockResolvedValue(true);
    expect(await svc.isEnabled()).toBe(true);
  });

  describe("sendWith (explicit config -- used to validate a not-yet-active provider)", () => {
    it("refuses a disabled config: 503 mail.notConfigured, nothing transported", async () => {
      const err = await svc.sendWith(OFF, { to: "x@y.test", subject: "s", text: "t" }).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(createTransport).not.toHaveBeenCalled();
    });

    it("smtp builds an auth-less transport (ignoreTLS on)", async () => {
      await svc.sendWith(SMTP, { to: "x@y.test", subject: "s", text: "t" });
      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: "mail-postfix", port: 25, ignoreTLS: true, auth: undefined })
      );
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it("brevo uses its relay, credentials and verified sender as from", async () => {
      await svc.sendWith(BREVO, { to: "x@y.test", subject: "s", text: "t" });
      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: "smtp-relay.brevo.com", ignoreTLS: false, auth: { user: "u", pass: "k" } })
      );
      expect(sendMail.mock.calls[0][0]).toMatchObject({ from: "s@d.test", to: "x@y.test" });
    });

    it("falls back to postmaster@<fromDomain> when the config has no verified sender", async () => {
      await svc.sendWith(SMTP, { to: "x@y.test", subject: "s", text: "t", fromDomain: "energie90.fr" });
      expect(sendMail.mock.calls[0][0]).toMatchObject({ from: "postmaster@energie90.fr" });
    });

    it("spools per recipient: a second send within the window to the same address is dropped, others still go", async () => {
      await svc.sendWith(SMTP, { to: "dup@y.test", subject: "s", text: "t" });
      await svc.sendWith(SMTP, { to: "dup@y.test", subject: "s", text: "t" });
      expect(sendMail).toHaveBeenCalledTimes(1);
      await svc.sendWith(SMTP, { to: "other@y.test", subject: "s", text: "t" });
      expect(sendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe("notifications and invitations go through the selected config", () => {
    it("sendNotification reads the selected config and sends", async () => {
      settings.toConfig.mockResolvedValue(BREVO);
      await svc.sendNotification({ to: "x@y.test", subject: "s", text: "line" });
      expect(settings.toConfig).toHaveBeenCalled();
      expect(sendMail.mock.calls[0][0]).toMatchObject({ from: "s@d.test", subject: "s" });
      expect(sendMail.mock.calls[0][0].html).toContain("line");
    });

    it("sendInvitation names the target groups and sends from postmaster@<fromDomain>", async () => {
      settings.toConfig.mockResolvedValue(SMTP);
      await svc.sendInvitation({
        to: "to@x.test",
        link: "https://link",
        fromDomain: "example.com",
        groupNames: ["Admins", "Support"],
      });
      const msg = sendMail.mock.calls[0][0];
      expect(msg.from).toBe("postmaster@example.com");
      expect(msg.subject).toBe("Invitation to manage the mail server");
      expect(msg.text).toContain("groups: Admins, Support");
      expect(msg.html).toContain("<code>Admins, Support</code>");
    });

    it("refuses to notify when nothing is selected (off)", async () => {
      settings.toConfig.mockResolvedValue(OFF);
      const err = await svc.sendNotification({ to: "x@y.test", subject: "s", text: "t" }).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  it("wraps a transport failure in a typed 502 mail.sendFailed, never a raw 500", async () => {
    sendMail.mockRejectedValueOnce(new Error("Invalid login: 535 5.7.8 Authentication failed"));
    const err = await svc.sendWith(SMTP, { to: "to@x.test", subject: "s", text: "t" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
