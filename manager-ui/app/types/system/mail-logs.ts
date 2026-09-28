export type MailLogService = "postfix" | "dovecot";

export interface MailLogArchive {
  name: string;
  size: number;
  rotatedAt: string;
}

export interface MailLogWindow {
  service: MailLogService;
  lines: string[];
  size: number;
  start: number;
  updatedAt: string | null;
  truncated: boolean;
  archives: MailLogArchive[];
}

export interface MailLogFrame {
  service: MailLogService;
  from: number;
  to: number;
  lines: string[];
}
