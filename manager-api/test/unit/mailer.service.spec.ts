import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger } from "@nestjs/common";

// The transport is built in the constructor, so nodemailer must be mocked
// before the service is instantiated. A single shared sendMail spy lets each
// test drive success/failure.
const h = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});

vi.mock("nodemailer", () => ({ createTransport: h.createTransport, default: { createTransport: h.createTransport } }));

import { MailerService } from "../../src/core/mailer/mailer.service";

vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

describe("MailerService", () => {
  let svc: MailerService;

  beforeEach(() => {
    h.sendMail.mockReset();
    h.sendMail.mockResolvedValue({ messageId: "id" });
    process.env.MANAGER_SMTP_FROM = "noreply@mail.test";
    svc = new MailerService();
  });

  it("sends an invitation naming the target group", async () => {
    await expect(svc.sendInvitation("to@x.test", "https://link", "Admins")).resolves.toBeUndefined();
    const msg = h.sendMail.mock.calls[0][0];
    expect(msg.from).toBe("noreply@mail.test");
    expect(msg.to).toBe("to@x.test");
    expect(msg.subject).toBe("Invitation to manage the mail server");
    expect(msg.text).toContain("group: Admins");
    expect(msg.text).toContain("https://link");
    expect(msg.html).toContain("<code>Admins</code>");
  });

  it("sends an invitation with the no-group wording when groupName is null", async () => {
    await svc.sendInvitation("to@x.test", "https://link", null);
    const msg = h.sendMail.mock.calls[0][0];
    expect(msg.text).toContain("no group (no permissions until assigned)");
    expect(msg.html).toContain("no group (no permissions until assigned)");
  });

  it("falls back to a noreply@ sender using MAIL_HOSTNAME when MANAGER_SMTP_FROM is unset", async () => {
    delete process.env.MANAGER_SMTP_FROM;
    process.env.MAIL_HOSTNAME = "mail.example.org";
    await svc.sendInvitation("to@x.test", "https://link", null);
    expect(h.sendMail.mock.calls[0][0].from).toBe("noreply@mail.example.org");
    delete process.env.MAIL_HOSTNAME;
  });

  it("falls back to noreply@localhost when neither sender nor hostname is set", async () => {
    delete process.env.MANAGER_SMTP_FROM;
    delete process.env.MAIL_HOSTNAME;
    await svc.sendInvitation("to@x.test", "https://link", null);
    expect(h.sendMail.mock.calls[0][0].from).toBe("noreply@localhost");
  });

  it("logs and rethrows when the transport fails", async () => {
    h.sendMail.mockRejectedValueOnce(new Error("smtp unreachable"));
    await expect(svc.sendInvitation("to@x.test", "https://link", "Admins")).rejects.toThrow("smtp unreachable");
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
