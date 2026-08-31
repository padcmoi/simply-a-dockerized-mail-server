import type { MailSetting } from "../../../entities/mail-setting.entity";
import type { MailConfig } from "..";

export function smtpConfig(row: MailSetting | null): MailConfig {
  const user = row?.username?.trim();
  const auth = user ? { user, pass: row?.password ?? "" } : undefined;
  const from = row?.fromAddress?.trim() || undefined;
  const host = row?.host?.trim() ?? "";
  const port = row?.port ?? 587;
  const secure = port === 465;
  return {
    enabled: host.length > 0,
    provider: "smtp",
    host,
    port,
    secure,
    requireTLS: !secure && !!auth,
    auth,
    from,
  };
}
