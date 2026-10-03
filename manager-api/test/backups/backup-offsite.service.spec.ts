import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { BackupOffsiteService } from "../../src/core/backups/backup-offsite.service";

class TestOffsiteService extends BackupOffsiteService {
  constructor(protected readonly dir: string) {
    super();
  }
}

const TARGET = "bob@backup.example.com:/srv/mail";
const ARCHIVE = "backup-2026-10-02.tar.gz";

describe("BackupOffsiteService", () => {
  let dir: string;
  let svc: TestOffsiteService;

  const listing = (lines: string[]) => writeFile(join(dir, "offsite.conf"), `${lines.join("\n")}\n`);
  const listedAt = (at: Date, state = "listed", target = TARGET) =>
    listing([`TARGET=${target}`, `STATE=${state}`, `FILES=${ARCHIVE}`, `AT=${at.toISOString()}`]);
  const files = async () => (await readdir(dir)).sort();

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "backup-managed-"));
    svc = new TestOffsiteService(dir);
    await writeFile(join(dir, "config.conf"), `BACKUP_TIME=02:30\nBACKUP_OFFSITE=${TARGET}\n`);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("knows nothing until the host listed the off-site server", async () => {
    expect(await svc.state()).toEqual({ pending: false, target: "", listed: false, checkedAt: null });
    expect(await svc.listing()).toBeNull();
  });

  it("reads the place the host sends to, and holds anything else for none", async () => {
    expect(await svc.target()).toBe(TARGET);
    await writeFile(join(dir, "config.conf"), "BACKUP_TIME=02:30\nBACKUP_OFFSITE=bob@host:/srv; rm -rf /\n");
    expect(await svc.target()).toBe("");
    await rm(join(dir, "config.conf"));
    expect(await svc.target()).toBe("");
  });

  it("asks the host for a listing, once, and says it is awaited", async () => {
    expect(await svc.refresh(null)).toBe(true);
    const asked = await readFile(join(dir, "offsite-request.conf"), "utf8");
    expect(asked).toMatch(/^AT=\d{4}-\d{2}-\d{2}T/);
    expect(await svc.refresh(null)).toBe(true);
    expect(await readFile(join(dir, "offsite-request.conf"), "utf8")).toBe(asked);
    expect((await svc.state()).pending).toBe(true);
  });

  it("asks for nothing when the backup is not installed on the server, or sends nowhere", async () => {
    await writeFile(join(dir, "config.conf"), "BACKUP_TIME=02:30\nBACKUP_OFFSITE=\n");
    expect(await svc.refresh(null)).toBe(false);
    expect(await files()).toEqual(["config.conf"]);
    await rm(join(dir, "config.conf"));
    expect(await svc.refresh(null)).toBe(false);
    expect(await files()).toEqual([]);
  });

  it("keeps a listing less than a minute old, and asks again past that", async () => {
    await listedAt(new Date());
    expect(await svc.refresh(null)).toBe(false);
    expect(await files()).toEqual(["config.conf", "offsite.conf"]);
    await listedAt(new Date(Date.now() - 61_000));
    expect(await svc.refresh(null)).toBe(true);
    expect(await files()).toEqual(["config.conf", "offsite-request.conf", "offsite.conf"]);
  });

  it("asks again at once when an archive was sent after the listing, however recent it is", async () => {
    const at = new Date(Date.now() - 10_000);
    await listedAt(at);
    expect(await svc.refresh(at.getTime() - 1000)).toBe(false);
    expect(await svc.refresh(at.getTime() + 1000)).toBe(true);
    expect(await files()).toEqual(["config.conf", "offsite-request.conf", "offsite.conf"]);
  });

  it("asks again when the listing is the one of another place", async () => {
    await listedAt(new Date(), "listed", "bob@old.example.com:/srv/mail");
    expect(await svc.refresh(null)).toBe(true);
  });

  it("does not ask again within a minute of a listing that failed", async () => {
    const at = new Date(Date.now() - 10_000);
    await listedAt(at, "error");
    expect(await svc.refresh(at.getTime() + 1000)).toBe(false);
    expect(await files()).toEqual(["config.conf", "offsite.conf"]);
  });

  it("reads the archives the host found there, and only names of archives", async () => {
    await listing([`TARGET=${TARGET}`, "STATE=listed", `FILES=${ARCHIVE},notes.txt,../x`, "AT=2026-10-02T22:31:00Z"]);
    expect(await svc.listing()).toEqual({ target: TARGET, names: new Set([ARCHIVE]), checkedAt: "2026-10-02T22:31:00Z" });
    expect(await svc.state()).toEqual({ pending: false, target: TARGET, listed: true, checkedAt: "2026-10-02T22:31:00Z" });
  });

  it("holds an empty off-site server for listed, with no archive", async () => {
    await listing([`TARGET=${TARGET}`, "STATE=listed", "FILES=", "AT=2026-10-02T22:31:00Z"]);
    expect((await svc.listing())?.names.size).toBe(0);
  });

  it("gives no listing when the host could not reach the off-site server", async () => {
    await listing([`TARGET=${TARGET}`, "STATE=error", "FILES=", "AT=2026-10-02T22:31:00Z"]);
    expect(await svc.listing()).toBeNull();
    expect(await svc.state()).toEqual({ pending: false, target: TARGET, listed: false, checkedAt: "2026-10-02T22:31:00Z" });
  });
});
