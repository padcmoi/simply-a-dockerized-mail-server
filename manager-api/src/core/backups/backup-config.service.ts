import { HttpStatus, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ApiError } from "../common/api-error";
import { BACKUP_MANAGED_PATH, managedFileExists, readManagedFile, writeManagedFile } from "./backup-managed";
import { BACKUP_OFFSITE_PATTERN, BACKUP_TIME_PATTERN, type BackupConfigDto } from "./backup.validation";

export interface BackupConfigView {
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

export interface BackupConfigState {
  configured: boolean;
  config: BackupConfigView | null;
  pending: boolean;
  lastRequest: BackupRequestStatus | null;
}

@Injectable()
export class BackupConfigService {
  protected readonly dir: string = BACKUP_MANAGED_PATH;

  async state(): Promise<BackupConfigState> {
    const [published, request, status] = await Promise.all([
      readManagedFile(this.dir, "config.conf"),
      managedFileExists(this.dir, "request.conf"),
      readManagedFile(this.dir, "status.conf"),
    ]);
    const config = published ? this.viewOf(published) : null;
    return {
      configured: config !== null,
      config,
      pending: config !== null && request,
      lastRequest:
        status && (status.STATE === "applied" || status.STATE === "error")
          ? { state: status.STATE, error: status.ERROR ?? "", at: status.AT || null }
          : null,
    };
  }

  async request(input: BackupConfigDto): Promise<BackupConfigState> {
    const current = await this.state();
    if (!current.configured) {
      throw new ApiError(HttpStatus.CONFLICT, "backup.notConfigured", "The backup is not installed on the server");
    }
    const lines = [
      `REQUEST_ID=${randomUUID()}`,
      `BACKUP_TIME=${input.time}`,
      `BACKUP_KEEP_DAYS=${input.keepDays}`,
      `BACKUP_OFFSITE=${input.offsite}`,
      `BACKUP_OFFSITE_DELETE_LOCAL=${input.offsiteDeleteLocal ? "yes" : "no"}`,
    ];
    await writeManagedFile(this.dir, "request.conf", lines);
    return this.state();
  }

  private viewOf(raw: Record<string, string>): BackupConfigView | null {
    const keepDays = Number(raw.BACKUP_KEEP_DAYS);
    if (!BACKUP_TIME_PATTERN.test(raw.BACKUP_TIME ?? "") || !Number.isInteger(keepDays) || keepDays < 1) return null;
    const offsite = raw.BACKUP_OFFSITE ?? "";
    return {
      time: raw.BACKUP_TIME,
      keepDays,
      dir: raw.BACKUP_DIR ?? "",
      offsite: BACKUP_OFFSITE_PATTERN.test(offsite) ? offsite : "",
      offsiteDeleteLocal: (raw.BACKUP_OFFSITE_DELETE_LOCAL ?? "yes") !== "no",
      timezone: raw.TIMEZONE ?? "UTC",
      publishedAt: raw.PUBLISHED_AT || null,
    };
  }
}
