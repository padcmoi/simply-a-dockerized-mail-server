import { HttpStatus, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { stat } from "fs/promises";
import { join } from "path";
import { ApiError } from "../common/api-error";
import { BACKUP_MANAGED_PATH, managedFileExists, readManagedFile, writeManagedFile } from "./backup-managed";
import { BACKUP_ARCHIVE_PATTERN } from "./backup.validation";

export const BACKUP_STREAM_PIPE = "retrieve.pipe";

export interface BackupRetrievalState {
  pending: { id: string; name: string } | null;
  last: { id: string; name: string; state: "ready" | "done" | "error"; error: string; at: string | null } | null;
}

export interface BackupStream {
  id: string;
  path: string;
  bytes: number;
}

// An archive that was sent off-site is not on this server anymore, and only
// root on the host holds the ssh key that reaches the other server. So the
// manager asks the host to read it there: it writes retrieve.conf in the
// folder it shares with the host, `scripts/backup.apply.sh` opens the archive
// on the other server over ssh, feeds it into a pipe of that folder and says
// `ready` in retrieve-status.conf. The download reads that pipe: the archive
// goes from the other server to the browser and is never written on this
// server. A pipe is read once, so one request gives one download.
@Injectable()
export class BackupRetrievalService {
  protected readonly dir: string = BACKUP_MANAGED_PATH;
  private taken: string | null = null;

  async state(): Promise<BackupRetrievalState> {
    const [request, status] = await Promise.all([
      readManagedFile(this.dir, "retrieve.conf"),
      readManagedFile(this.dir, "retrieve-status.conf"),
    ]);
    return {
      pending:
        request && BACKUP_ARCHIVE_PATTERN.test(request.NAME ?? "") ? { id: request.REQUEST_ID ?? "", name: request.NAME } : null,
      last:
        status && (status.STATE === "ready" || status.STATE === "done" || status.STATE === "error")
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

  async request(name: string, from: string): Promise<BackupRetrievalState> {
    const [configured, current] = await Promise.all([managedFileExists(this.dir, "config.conf"), this.state()]);
    if (!configured) {
      throw new ApiError(HttpStatus.CONFLICT, "backup.notConfigured", "The backup is not installed on the server");
    }
    if (current.pending) {
      if (current.pending.name === name) return current;
      throw this.busy();
    }
    if (current.last?.state === "ready") {
      if (current.last.name === name && current.last.id !== this.taken) return current;
      throw this.busy();
    }
    await writeManagedFile(this.dir, "retrieve.conf", [`REQUEST_ID=${randomUUID()}`, `NAME=${name}`, `FROM=${from}`]);
    return this.state();
  }

  async ready(name: string): Promise<BackupStream | null> {
    const status = await readManagedFile(this.dir, "retrieve-status.conf");
    if (!status || status.STATE !== "ready" || status.NAME !== name || !status.REQUEST_ID) return null;
    const bytes = Number(status.BYTES);
    const path = join(this.dir, BACKUP_STREAM_PIPE);
    const pipe = await stat(path).catch(() => null);
    if (!pipe?.isFIFO() || !Number.isSafeInteger(bytes) || bytes <= 0 || status.REQUEST_ID === this.taken) return null;
    return { id: status.REQUEST_ID, path, bytes };
  }

  async take(name: string): Promise<BackupStream | null> {
    const stream = await this.ready(name);
    if (!stream || stream.id === this.taken) return null;
    this.taken = stream.id;
    return stream;
  }

  private busy() {
    return new ApiError(
      HttpStatus.CONFLICT,
      "backup.retrievalBusy",
      "Another archive is being downloaded from the off-site server"
    );
  }
}
