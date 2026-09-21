import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";

export interface DmarcMail {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  filename: string;
  content: Buffer;
}

@Injectable()
export class DmarcMailerService {
  private transport() {
    return nodemailer.createTransport({
      host: process.env.DMARC_SMTP_HOST ?? "mail-postfix",
      port: Number(process.env.DMARC_SMTP_PORT ?? 25),
      secure: false,
      ignoreTLS: true,
    });
  }

  async send(mail: DmarcMail): Promise<void> {
    await this.transport().sendMail({
      from: { name: mail.fromName, address: mail.from },
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      attachments: [{ filename: mail.filename, content: mail.content, contentType: "application/gzip" }],
    });
  }
}
