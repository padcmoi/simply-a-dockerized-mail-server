import { HttpStatus, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ApiError } from "../common/api-error";
import { BACKUP_MANAGED_PATH, managedFileExists, readManagedFile, writeManagedFile } from "./backup-managed";
import { BACKUP_ARCHIVE_PATTERN } from "./backup.validation";

export interface BackupRetrievalState {
  pending: { id: string; name: string } | null;
  last: { id: string; name: string; state: "done" | "error"; error: string; at: string | null } | null;
}

// An archive that was sent off-site is not on this server anymore, and only
// root on the host holds the ssh key that reaches the other server. So the
// manager asks the host to bring the archive back: it writes retrieve.conf in
// the folder it shares with the host, `scripts/backup.apply.sh` copies the
// archive into the folder of the archives and answers in retrieve-status.conf.
// Once back, the archive is found there like any other and can be downloaded.
@Injectable()
export class BackupRetrievalService {
  protected readonly dir: string = BACKUP_MANAGED_PATH;

  async state(): Promise<BackupRetrievalState> {
    const [request, status] = await Promise.all([
      readManagedFile(this.dir, "retrieve.conf"),
      readManagedFile(this.dir, "retrieve-status.conf"),
    ]);
    return {
      pending:
        request && BACKUP_ARCHIVE_PATTERN.test(request.NAME ?? "") ? { id: request.REQUEST_ID ?? "", name: request.NAME } : null,
      last:
        status && (status.STATE === "done" || status.STATE === "error")
          ? {
              id: status.REQUEST_ID ?? "",
              name: status.NAME ?? "",
              state: status.STATE,
              error: status.ERROR ?? "",
              at: status.AT || null,
            }
          : null,
    };
  }

  async request(name: string, from: string, bytes: number): Promise<BackupRetrievalState> {
    const [configured, current] = await Promise.all([managedFileExists(this.dir, "config.conf"), this.state()]);
    if (!configured) {
      throw new ApiError(HttpStatus.CONFLICT, "backup.notConfigured", "The backup is not installed on the server");
    }
    if (current.pending) {
      if (current.pending.name === name) return current;
      throw new ApiError(HttpStatus.CONFLICT, "backup.retrievalBusy", "Another archive is being brought back to the server");
    }
    await writeManagedFile(this.dir, "retrieve.conf", [
      `REQUEST_ID=${randomUUID()}`,
      `NAME=${name}`,
      `FROM=${from}`,
      `BYTES=${bytes}`,
    ]);
    return this.state();
  }
}
