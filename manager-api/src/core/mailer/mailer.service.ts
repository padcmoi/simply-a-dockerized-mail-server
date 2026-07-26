import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { ApiError } from "../common/api-error";
import { MailConfig } from "./providers";
import { MailSettingsService } from "./mail-settings.service";
import { invitationEmail, notificationHtml } from "./templates";
import { AppSettingsService } from "../settings/app-settings.service";

@Injectable()
export class MailerService {
  private readonly log = new Logger(MailerService.name);
  private readonly lastSentAt = new Map<string, number>();

  constructor(
    private readonly settings: MailSettingsService,
    private readonly appSettings: AppSettingsService
  ) {}

  isEnabled(): Promise<boolean> {
    return this.settings.isEnabled();
  }

  private transport(cfg: MailConfig) {
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      requireTLS: cfg.requireTLS,
      ignoreTLS: !cfg.auth,
      auth: cfg.auth,
    });
  }

  async sendWith(cfg: MailConfig, input: { to: string; subject: string; text: string; html?: string; fromDomain?: string }) {
    if (!cfg.enabled) {
      throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "mail.notConfigured", "Outbound mail is not configured");
    }
    if (this.spooled(input.to, Date.now())) {
      this.log.warn(`Mail to ${input.to} dropped: one send per ${this.appSettings.get().mailMinIntervalMs}ms per recipient`);
      return;
    }
    const domain = input.fromDomain ?? process.env.MANAGER_MAIL_DOMAIN ?? input.to.split("@")[1];
    const from = cfg.from ?? `postmaster@${domain}`;
    try {
      await this.transport(cfg).sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? notificationHtml(input.text),
      });
    } catch (e) {
      const detail = (e as Error).message;
      this.log.error(`Failed to send mail to ${input.to}: ${detail}`);
      throw new ApiError(HttpStatus.BAD_GATEWAY, "mail.sendFailed", detail, { detail });
    }
  }

  private spooled(to: string, now: number): boolean {
    const windowMs = this.appSettings.get().mailMinIntervalMs;
    for (const [addr, at] of this.lastSentAt) {
      if (now - at >= windowMs) this.lastSentAt.delete(addr);
    }
    const last = this.lastSentAt.get(to);
    if (last !== undefined && now - last < windowMs) return true;
    this.lastSentAt.set(to, now);
    return false;
  }

  async sendNotification(input: { to: string; subject: string; text: string; html?: string }) {
    await this.sendWith(await this.settings.toConfig(), input);
  }

  async sendInvitation(input: { to: string; link: string; fromDomain: string; groupNames: string[] }) {
    const { subject, text, html } = invitationEmail({ link: input.link, groupNames: input.groupNames });
    await this.sendWith(await this.settings.toConfig(), { to: input.to, subject, text, html, fromDomain: input.fromDomain });
  }
}
