import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { invitationEmail, notificationHtml } from "./templates";

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
      await this.transport.sendMail({ from, to, subject, text, html: notificationHtml(text) });
    } catch (e) {
      this.log.error(`Failed to send notification to ${to}: ${(e as Error).message}`);
      throw e;
    }
  }

  async sendInvitation(input: { to: string; link: string; fromDomain: string; groupNames: string[] }) {
    const { to, link, fromDomain, groupNames } = input;
    const from = `postmaster@${fromDomain}`;
    const { subject, text, html } = invitationEmail({ link, groupNames });

    try {
      await this.transport.sendMail({ from, to, subject, text, html });
    } catch (e) {
      this.log.error(`Failed to send invitation to ${to}: ${(e as Error).message}`);
      throw e;
    }
  }
}
