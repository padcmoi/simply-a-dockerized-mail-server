import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import * as nodemailer from "nodemailer";
import { PassThrough } from "stream";

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

  async resend(path: string, from: string, to: string, now = new Date()): Promise<void> {
    const file = createReadStream(path);
    const raw = new PassThrough();
    raw.write(
      `Resent-From: ${from}\nResent-To: ${to}\nResent-Date: ${now.toUTCString()}\n` +
        `Resent-Message-ID: <${randomUUID()}@${from.slice(from.indexOf("@") + 1)}>\n`
    );
    file.on("error", (error) => raw.destroy(error)).pipe(raw);
    try {
      await this.transport().sendMail({ envelope: { from, to }, raw });
    } finally {
      file.destroy();
    }
  }
}
