import { Injectable } from "@nestjs/common";
import { BACKUP_MANAGED_PATH, managedFileExists, readManagedFile, writeManagedFile } from "./backup-managed";
import { BACKUP_ARCHIVE_PATTERN } from "./backup.validation";

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

  async listing(): Promise<BackupOffsiteListing | null> {
    const raw = await readManagedFile(this.dir, "offsite.conf");
    if (!raw || raw.STATE !== "listed" || !raw.TARGET || !raw.AT) return null;
    const names = (raw.FILES ?? "").split(",").filter((name) => BACKUP_ARCHIVE_PATTERN.test(name));
    return { target: raw.TARGET, names: new Set(names), checkedAt: raw.AT };
  }

  async refresh() {
    const [configured, pending, raw] = await Promise.all([
      managedFileExists(this.dir, "config.conf"),
      managedFileExists(this.dir, "offsite-request.conf"),
      readManagedFile(this.dir, "offsite.conf"),
    ]);
    if (!configured || pending) return;
    if (raw?.AT && Date.now() - Date.parse(raw.AT) < LISTING_FRESH_MS) return;
    await writeManagedFile(this.dir, "offsite-request.conf", [`AT=${new Date().toISOString()}`]);
  }
}
