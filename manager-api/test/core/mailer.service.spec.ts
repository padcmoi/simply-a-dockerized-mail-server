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
    svc = new MailerService();
  });

  it("sends from postmaster@<domain> and names the target groups", async () => {
    await expect(
      svc.sendInvitation({
        to: "to@x.test",
        link: "https://link",
        fromDomain: "example.com",
        groupNames: ["Admins", "Support"],
      })
    ).resolves.toBeUndefined();
    const msg = h.sendMail.mock.calls[0][0];
    expect(msg.from).toBe("postmaster@example.com");
    expect(msg.to).toBe("to@x.test");
    expect(msg.subject).toBe("Invitation to manage the mail server");
    expect(msg.text).toContain("groups: Admins, Support");
    expect(msg.text).toContain("https://link");
    expect(msg.html).toContain("<code>Admins, Support</code>");
  });

  it("uses the no-group wording when groupNames is empty", async () => {
    await svc.sendInvitation({ to: "to@x.test", link: "https://link", fromDomain: "example.com", groupNames: [] });
    const msg = h.sendMail.mock.calls[0][0];
    expect(msg.text).toContain("no group (no permissions until assigned)");
    expect(msg.html).toContain("no group (no permissions until assigned)");
  });

  it("logs and rethrows when the transport fails", async () => {
    h.sendMail.mockRejectedValueOnce(new Error("smtp unreachable"));
    await expect(
      svc.sendInvitation({ to: "to@x.test", link: "https://link", fromDomain: "example.com", groupNames: ["Admins"] })
    ).rejects.toThrow("smtp unreachable");
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
