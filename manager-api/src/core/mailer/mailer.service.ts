import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailerService {
  private readonly log = new Logger(MailerService.name);

  private readonly transport = nodemailer.createTransport({
    host: process.env.MANAGER_SMTP_HOST ?? "mail-postfix",
    port: Number(process.env.MANAGER_SMTP_PORT ?? 25),
    secure: false,
    ignoreTLS: true,
  });

  async sendNotification(input: { to: string; subject: string; text: string }) {
    const { to, subject, text } = input;
    const from = `postmaster@${process.env.MANAGER_MAIL_DOMAIN ?? to.split("@")[1]}`;
    try {
      await this.transport.sendMail({
        from,
        to,
        subject,
        text,
        html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
      });
    } catch (e) {
      this.log.error(`Failed to send notification to ${to}: ${(e as Error).message}`);
      throw e;
    }
  }

  async sendInvitation(input: { to: string; link: string; fromDomain: string; groupNames: string[] }) {
    const { to, link, fromDomain, groupNames } = input;
    const from = `postmaster@${fromDomain}`;
    const scopeText = groupNames.length ? `groups: ${groupNames.join(", ")}` : "no group (no permissions until assigned)";
    const scopeHtml = groupNames.length
      ? `groups: <strong><code>${groupNames.join(", ")}</code></strong>`
      : "<strong>no group (no permissions until assigned)</strong>";

    try {
      await this.transport.sendMail({
        from,
        to,
        subject: "Invitation to manage the mail server",
        text: [
          `You have been invited to manage this mail server, with ${scopeText}.`,
          "",
          `Set up your account here: ${link}`,
          "",
          "This invitation expires in 7 days.",
        ].join("\n"),
        html: `
          <p>You have been invited to manage this mail server, with ${scopeHtml}.</p>
          <p style="margin:24px 0">
            <a href="${link}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
              Set up your account
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">This invitation expires in 7 days.</p>
        `,
      });
    } catch (e) {
      this.log.error(`Failed to send invitation to ${to}: ${(e as Error).message}`);
      throw e;
    }
  }
}
