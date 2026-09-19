export type MailLogService = "postfix" | "dovecot";

export interface MailLogWindow {
  service: MailLogService;
  lines: string[];
  size: number;
  start: number;
  updatedAt: string | null;
  truncated: boolean;
}

export interface MailLogFrame {
  service: MailLogService;
  from: number;
  to: number;
  lines: string[];
}
