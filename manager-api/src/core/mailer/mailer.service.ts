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

  async sendInvitation(to: string, link: string, groupName: string | null) {
    const from = process.env.MANAGER_SMTP_FROM ?? `noreply@${process.env.MAIL_HOSTNAME ?? "localhost"}`;
    const scopeText = groupName ? `group: ${groupName}` : "no group (no permissions until assigned)";
    const scopeHtml = groupName
      ? `group: <strong><code>${groupName}</code></strong>`
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
