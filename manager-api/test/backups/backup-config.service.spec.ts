import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { BackupConfigService } from "../../src/core/backups/backup-config.service";
import { ApiError } from "../../src/core/common/api-error";

class TestConfigService extends BackupConfigService {
  constructor(protected readonly dir: string) {
    super();
  }
}

const PUBLISHED = [
  "BACKUP_TIME=02:30",
  "BACKUP_KEEP_DAYS=5",
  "BACKUP_DIR=./backup",
  "BACKUP_OFFSITE=bob@backup.example.com:/srv/mail",
  "BACKUP_OFFSITE_DELETE_LOCAL=no",
  "TIMEZONE=Europe/Paris",
  "PUBLISHED_AT=2026-10-01T14:24:00Z",
  "",
].join("\n");

describe("BackupConfigService", () => {
  let dir: string;
  let svc: TestConfigService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "backup-managed-"));
    svc = new TestConfigService(dir);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("says the backup is not configured while the host published nothing", async () => {
    expect(await svc.state()).toEqual({ configured: false, config: null, pending: false, lastRequest: null });
  });

  it("reads the configuration the host published", async () => {
    await writeFile(join(dir, "config.conf"), PUBLISHED);
    expect(await svc.state()).toEqual({
      configured: true,
      config: {
        time: "02:30",
        keepDays: 5,
        dir: "./backup",
        offsite: "bob@backup.example.com:/srv/mail",
        offsiteDeleteLocal: false,
        timezone: "Europe/Paris",
        publishedAt: "2026-10-01T14:24:00Z",
      },
      pending: false,
      lastRequest: null,
    });
  });

  it("treats a published file it cannot trust as not configured", async () => {
    await writeFile(join(dir, "config.conf"), "BACKUP_TIME=later\nBACKUP_KEEP_DAYS=many\n");
    expect((await svc.state()).configured).toBe(false);
  });

  it("drops an off-site destination that is not user@host:/path", async () => {
    await writeFile(join(dir, "config.conf"), PUBLISHED.replace("bob@backup.example.com:/srv/mail", "/mnt/disk; rm -rf /"));
    expect((await svc.state()).config?.offsite).toBe("");
  });

  it("refuses a change when the backup is not installed on the server, and writes nothing", async () => {
    const err = await svc.request({ time: "03:00", keepDays: 3, offsite: "", offsiteDeleteLocal: true }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).getStatus()).toBe(409);
    expect(await readdir(dir)).toEqual([]);
  });

  it("writes the request for the host and reports it as pending", async () => {
    await writeFile(join(dir, "config.conf"), PUBLISHED);
    const state = await svc.request({ time: "03:00", keepDays: 3, offsite: "", offsiteDeleteLocal: false });
    expect(state.pending).toBe(true);
    const lines = (await readFile(join(dir, "request.conf"), "utf8")).trim().split("\n");
    expect(lines[0]).toMatch(/^REQUEST_ID=[0-9a-f-]{36}$/);
    expect(lines.slice(1)).toEqual([
      "BACKUP_TIME=03:00",
      "BACKUP_KEEP_DAYS=3",
      "BACKUP_OFFSITE=",
      "BACKUP_OFFSITE_DELETE_LOCAL=no",
    ]);
    expect((await readdir(dir)).sort()).toEqual(["config.conf", "request.conf"]);
  });

  it("reports what the host answered to the last request", async () => {
    await writeFile(join(dir, "config.conf"), PUBLISHED);
    await writeFile(
      join(dir, "status.conf"),
      "REQUEST_ID=x\nSTATE=error\nERROR=the time is not HH:MM\nAT=2026-10-02T09:00:00Z\n"
    );
    expect((await svc.state()).lastRequest).toEqual({
      state: "error",
      error: "the time is not HH:MM",
      at: "2026-10-02T09:00:00Z",
    });
  });
});
