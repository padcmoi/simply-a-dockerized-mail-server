export type BackupResult = "success" | "partial" | "failed";

export interface BackupConfig {
  time: string;
  keepDays: number;
  dir: string;
  offsite: string;
  offsiteDeleteLocal: boolean;
  timezone: string;
  publishedAt: string | null;
}

export interface BackupRequestStatus {
  state: "applied" | "error";
  error: string;
  at: string | null;
}

export interface BackupRun {
  id: number;
  startedAt: string;
  finishedAt: string;
  result: BackupResult;
  step: string;
  error: string;
  durationSeconds: number;
  outageSeconds: number;
  archive: string;
  archiveBytes: number;
  storedIn: string;
  offsiteTarget: string;
  offsiteSent: number;
}

export interface BackupRetrieval {
  pending: { id: string; name: string } | null;
  last: { id: string; name: string; state: "done" | "error"; error: string; at: string | null } | null;
}

export interface BackupOverview {
  configured: boolean;
  config: BackupConfig | null;
  pending: boolean;
  lastRequest: BackupRequestStatus | null;
  lastRun: BackupRun | null;
  projectReadable: boolean;
  retrieval: BackupRetrieval | null;
}

export interface BackupFile {
  name: string;
  bytes: number;
  createdAt: string;
  localDir: string;
  localProjectDir: string | null;
  localPresent: number;
  localDeletedAt: string | null;
  offsiteTarget: string;
  offsiteSentAt: string | null;
  offsiteDeletedAt: string | null;
  verifiable: boolean;
  downloadable: boolean;
  retrievable: boolean;
}

export interface BackupRunLog {
  id: number;
  startedAt: string;
  lines: string[];
}

export interface BackupConfigForm {
  time: string;
  keepDays: number;
  offsite: string;
  offsiteDeleteLocal: boolean;
}
