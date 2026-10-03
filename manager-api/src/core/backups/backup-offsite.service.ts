import { Injectable } from "@nestjs/common";
import { BACKUP_MANAGED_PATH, managedFileExists, readManagedFile, writeManagedFile } from "./backup-managed";
import { BACKUP_ARCHIVE_PATTERN, BACKUP_OFFSITE_PATTERN } from "./backup.validation";

const LISTING_FRESH_MS = 60_000;

export interface BackupOffsiteState {
  pending: boolean;
  target: string;
  listed: boolean;
  checkedAt: string | null;
}

export interface BackupOffsiteListing {
  target: string;
  names: Set<string>;
  checkedAt: string;
}

@Injectable()
export class BackupOffsiteService {
  protected readonly dir: string = BACKUP_MANAGED_PATH;

  async state(): Promise<BackupOffsiteState> {
    const [pending, raw] = await Promise.all([
      managedFileExists(this.dir, "offsite-request.conf"),
      readManagedFile(this.dir, "offsite.conf"),
    ]);
    return { pending, target: raw?.TARGET ?? "", listed: raw?.STATE === "listed", checkedAt: raw?.AT || null };
  }

  async target(): Promise<string> {
    const config = await readManagedFile(this.dir, "config.conf");
    const offsite = config?.BACKUP_OFFSITE ?? "";
    return BACKUP_OFFSITE_PATTERN.test(offsite) ? offsite : "";
  }

  async listing(): Promise<BackupOffsiteListing | null> {
    const raw = await readManagedFile(this.dir, "offsite.conf");
    if (!raw || raw.STATE !== "listed" || !raw.TARGET || !raw.AT) return null;
    const names = (raw.FILES ?? "").split(",").filter((name) => BACKUP_ARCHIVE_PATTERN.test(name));
    return { target: raw.TARGET, names: new Set(names), checkedAt: raw.AT };
  }

  async refresh(newestSentAt: number | null): Promise<boolean> {
    const [target, pending, raw] = await Promise.all([
      this.target(),
      managedFileExists(this.dir, "offsite-request.conf"),
      readManagedFile(this.dir, "offsite.conf"),
    ]);
    if (!target) return false;
    if (pending) return true;
    const at = raw && raw.TARGET === target && raw.AT ? Date.parse(raw.AT) : NaN;
    const recent = Date.now() - at < LISTING_FRESH_MS;
    const covers = raw?.STATE !== "listed" || newestSentAt === null || at >= newestSentAt;
    if (recent && covers) return false;
    await writeManagedFile(this.dir, "offsite-request.conf", [`AT=${new Date().toISOString()}`]);
    return true;
  }
}
