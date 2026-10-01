import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { HttpStatus } from "@nestjs/common";
import { InternalAlertController } from "../../src/api/internal/internal-alert.controller";
import { LoopbackGuard } from "../../src/core/auth/loopback.guard";
import { ApiError } from "../../src/core/common/api-error";
import { MailerService } from "../../src/core/mailer/mailer.service";
import { AppSettingsService } from "../../src/core/settings/app-settings.service";
import { buildHarness, ROOT, type Harness } from "../helpers/e2e";

const url = "/api/v1/internal/alert";
const body = { subject: "Backup failed", message: "Not enough room on /docker-data" };

describe("InternalAlertController (e2e: machine-only route)", () => {
  let h: Harness;
  const settings = { get: vi.fn() };
  const mailer = { sendNotification: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [InternalAlertController],
      providers: [
        LoopbackGuard,
        { provide: AppSettingsService, useValue: settings },
        { provide: MailerService, useValue: mailer },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    settings.get.mockReset().mockReturnValue({ adminAlertEmail: "admin@example.com", mailMinIntervalMs: 30_000 });
    mailer.sendNotification.mockReset().mockResolvedValue(true);
  });

  const api = () => request(h.app.getHttpServer());

  describe("from the machine itself (loopback, no token)", () => {
    it("204 and mails the alert address", async () => {
      await api().post(url).send(body).expect(204);
      expect(mailer.sendNotification).toHaveBeenCalledWith({
        to: "admin@example.com",
        subject: "Backup failed",
        text: "Not enough room on /docker-data",
      });
    });

    it("409 alert.noAddress when no address is set, nothing sent", async () => {
      settings.get.mockReturnValue({ adminAlertEmail: "", mailMinIntervalMs: 30_000 });
      const res = await api().post(url).send(body).expect(409);
      expect(res.body.code).toBe("alert.noAddress");
      expect(mailer.sendNotification).not.toHaveBeenCalled();
    });

    it("429 alert.tooSoon when the mailer dropped the message", async () => {
      mailer.sendNotification.mockResolvedValue(false);
      const res = await api().post(url).send(body).expect(429);
      expect(res.body.code).toBe("alert.tooSoon");
    });

    it("503 when outbound mail is not configured", async () => {
      mailer.sendNotification.mockRejectedValue(
        new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "mail.notConfigured", "Outbound mail is not configured")
      );
      const res = await api().post(url).send(body).expect(503);
      expect(res.body.code).toBe("mail.notConfigured");
    });

    const rejected: [string, unknown][] = [
      ["no subject", { message: "m" }],
      ["no message", { subject: "s" }],
      ["an empty subject", { subject: "  ", message: "m" }],
      ["a subject on two lines", { subject: "s\r\nBcc: x@y.com", message: "m" }],
      ["a subject of 201 characters", { subject: "s".repeat(201), message: "m" }],
      ["a message of 10001 characters", { subject: "s", message: "m".repeat(10_001) }],
      ["a recipient chosen by the caller, alone", { to: "x@y.com" }],
    ];
    for (const [name, payload] of rejected) {
      it(`400 for ${name}, nothing sent`, async () => {
        await api()
          .post(url)
          .send(payload as object)
          .expect(400);
        expect(mailer.sendNotification).not.toHaveBeenCalled();
      });
    }

    it("never lets the caller choose the recipient", async () => {
      await api()
        .post(url)
        .send({ ...body, to: "attacker@example.com", adminAlertEmail: "attacker@example.com" })
        .expect(204);
      expect(mailer.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@example.com" }));
    });
  });

  describe("through a proxy (anything coming from outside the machine)", () => {
    for (const header of ["X-Forwarded-For", "X-Real-IP", "X-Forwarded-Host", "Forwarded"]) {
      it(`403 with ${header}, nothing sent`, async () => {
        await api().post(url).set(header, "203.0.113.7").send(body).expect(403);
        expect(mailer.sendNotification).not.toHaveBeenCalled();
      });
    }

    it("403 even for a root token", async () => {
      await api()
        .post(url)
        .set("X-Forwarded-For", "127.0.0.1")
        .set("Authorization", `Bearer ${h.token(ROOT)}`)
        .send(body)
        .expect(403);
      expect(mailer.sendNotification).not.toHaveBeenCalled();
    });
  });

  it("answers no other method", async () => {
    await api().get(url).expect(404);
  });
});
