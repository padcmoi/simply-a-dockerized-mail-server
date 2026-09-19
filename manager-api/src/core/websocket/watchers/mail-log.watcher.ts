import type { MailLogsService } from "../../../api/mail-logs/mail-logs.service";
import { MAIL_LOG_SERVICES, type MailLogService } from "../../../api/mail-logs/mail-logs.validation";
import { Watcher } from "../watcher.type";

export function mailLogWatcher(logs: MailLogsService): Watcher {
  return {
    topic: "mail-log",
    parameterized: true,
    permissions: [{ resource: "supervision", actions: ["access", "view-mail-logs"] }],
    intervalMs: 1_000,
    fn: (param) => ((MAIL_LOG_SERVICES as readonly string[]).includes(param ?? "") ? logs.follow(param as MailLogService) : null),
  };
}
