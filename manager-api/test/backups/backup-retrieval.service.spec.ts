import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { BackupRetrievalService } from "../../src/core/backups/backup-retrieval.service";
import { ApiError } from "../../src/core/common/api-error";

class TestRetrievalService extends BackupRetrievalService {
  constructor(protected readonly dir: string) {
    super();
  }
}

const ARCHIVE = "backup-2026-10-02.tar.gz";
const OTHER = "backup-2026-10-01.tar.gz";
const FROM = "bob@backup.example.com:/srv/mail";

describe("BackupRetrievalService", () => {
  let dir: string;
  let svc: TestRetrievalService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "backup-managed-"));
    svc = new TestRetrievalService(dir);
    await writeFile(join(dir, "config.conf"), "BACKUP_TIME=02:30\n");
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("has nothing pending and nothing answered at first", async () => {
    expect(await svc.state()).toEqual({ pending: null, last: null });
  });

  it("writes the request for the host and reports the archive as pending", async () => {
    const state = await svc.request(ARCHIVE, FROM, 4242);
    const lines = (await readFile(join(dir, "retrieve.conf"), "utf8")).trim().split("\n");
    expect(lines[0]).toMatch(/^REQUEST_ID=[0-9a-f-]{36}$/);
    expect(lines.slice(1)).toEqual([`NAME=${ARCHIVE}`, `FROM=${FROM}`, "BYTES=4242"]);
    expect(state).toEqual({ pending: { id: lines[0].slice("REQUEST_ID=".length), name: ARCHIVE }, last: null });
    expect((await readdir(dir)).sort()).toEqual(["config.conf", "retrieve.conf"]);
  });

  it("refuses when the backup is not installed on the server, and writes nothing", async () => {
    await rm(join(dir, "config.conf"));
    const error = await svc.request(ARCHIVE, FROM, 1).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, response: { code: "backup.notConfigured" } });
    expect(await readdir(dir)).toEqual([]);
  });

  it("asks once for an archive already being brought back", async () => {
    const first = await svc.request(ARCHIVE, FROM, 1);
    const again = await svc.request(ARCHIVE, FROM, 1);
    expect(again).toEqual(first);
  });

  it("refuses a second archive while one is being brought back, and keeps the first request", async () => {
    const first = await svc.request(ARCHIVE, FROM, 1);
    await expect(svc.request(OTHER, FROM, 1)).rejects.toMatchObject({ status: 409, response: { code: "backup.retrievalBusy" } });
    expect(await svc.state()).toEqual(first);
  });

  it("reports what the host answered", async () => {
    await writeFile(
      join(dir, "retrieve-status.conf"),
      `REQUEST_ID=abc\nNAME=${ARCHIVE}\nSTATE=error\nERROR=the archive could not be brought back from ${FROM}\nAT=2026-10-02T13:52:03Z\n`
    );
    expect(await svc.state()).toEqual({
      pending: null,
      last: {
        id: "abc",
        name: ARCHIVE,
        state: "error",
        error: `the archive could not be brought back from ${FROM}`,
        at: "2026-10-02T13:52:03Z",
      },
    });
  });

  it("ignores a request or an answer it cannot trust", async () => {
    await writeFile(join(dir, "retrieve.conf"), "REQUEST_ID=abc\nNAME=../../etc/passwd\n");
    await writeFile(join(dir, "retrieve-status.conf"), "STATE=whatever\n");
    expect(await svc.state()).toEqual({ pending: null, last: null });
  });
});
