import type { MailSetting } from "../../../entities/mail-setting.entity";
import type { MailConfig } from "..";

export const BREVO_PRESET = { host: "smtp-relay.brevo.com", port: 587, secure: false };

export function brevoConfig(row: MailSetting | null): MailConfig {
  const user = row?.username?.trim();
  const auth = user ? { user, pass: row?.password ?? "" } : undefined;
  const from = row?.fromAddress?.trim() || undefined;
  return {
    enabled: !!auth,
    provider: "brevo",
    host: BREVO_PRESET.host,
    port: BREVO_PRESET.port,
    secure: BREVO_PRESET.secure,
    auth,
    from,
  };
}
