import type { MailSetting } from "../../entities/mail-setting.entity";
import { brevoConfig } from "./brevo/brevo.config";
import { smtpConfig } from "./smtp/smtp.config";

export interface MailConfig {
  enabled: boolean;
  provider: string | null;
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
  auth?: { user: string; pass: string };
  from?: string;
}

const DISABLED: MailConfig = { enabled: false, provider: null, host: "", port: 587, secure: false };

export function rowToConfig(row: MailSetting | null): MailConfig {
  const provider = (row?.provider ?? "").trim().toLowerCase();
  if (provider === "brevo") return brevoConfig(row);
  if (provider === "smtp") return smtpConfig(row);
  return DISABLED;
}
