import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
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

  const answer = (state: string, over: Record<string, string> = {}) =>
    writeFile(
      join(dir, "retrieve-status.conf"),
      Object.entries({ REQUEST_ID: "abc", NAME: ARCHIVE, BYTES: "4242", STATE: state, ERROR: "", AT: "2026-10-02T13:52:03Z", ...over })
        .map(([key, value]) => `${key}=${value}\n`)
        .join("")
    );
  const pipe = () => execFileSync("mkfifo", [join(dir, "retrieve.pipe")]);

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
    const state = await svc.request(ARCHIVE, FROM);
    const lines = (await readFile(join(dir, "retrieve.conf"), "utf8")).trim().split("\n");
    expect(lines[0]).toMatch(/^REQUEST_ID=[0-9a-f-]{36}$/);
    expect(lines.slice(1)).toEqual([`NAME=${ARCHIVE}`, `FROM=${FROM}`]);
    expect(state).toEqual({ pending: { id: lines[0].slice("REQUEST_ID=".length), name: ARCHIVE }, last: null });
    expect((await readdir(dir)).sort()).toEqual(["config.conf", "retrieve.conf"]);
  });

  it("refuses when the backup is not installed on the server, and writes nothing", async () => {
    await rm(join(dir, "config.conf"));
    const error = await svc.request(ARCHIVE, FROM).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, response: { code: "backup.notConfigured" } });
    expect(await readdir(dir)).toEqual([]);
  });

  it("asks once for an archive already being opened off-site", async () => {
    const first = await svc.request(ARCHIVE, FROM);
    const again = await svc.request(ARCHIVE, FROM);
    expect(again).toEqual(first);
  });

  it("refuses a second archive while one is being opened off-site, and keeps the first request", async () => {
    const first = await svc.request(ARCHIVE, FROM);
    await expect(svc.request(OTHER, FROM)).rejects.toMatchObject({ status: 409, response: { code: "backup.retrievalBusy" } });
    expect(await svc.state()).toEqual(first);
  });

  it("reports what the host answered", async () => {
    await answer("error", { ERROR: `the archive could not be read at ${FROM}` });
    expect(await svc.state()).toEqual({
      pending: null,
      last: {
        id: "abc",
        name: ARCHIVE,
        state: "error",
        error: `the archive could not be read at ${FROM}`,
        at: "2026-10-02T13:52:03Z",
      },
    });
  });

  it("ignores a request or an answer it cannot trust", async () => {
    await writeFile(join(dir, "retrieve.conf"), "REQUEST_ID=abc\nNAME=../../etc/passwd\n");
    await writeFile(join(dir, "retrieve-status.conf"), "STATE=whatever\n");
    expect(await svc.state()).toEqual({ pending: null, last: null });
  });

  describe("the pipe the host feeds from the off-site server", () => {
    it("is handed out once the host says ready, with the size found off-site", async () => {
      await answer("ready");
      pipe();
      expect(await svc.ready(ARCHIVE)).toEqual({ id: "abc", path: join(dir, "retrieve.pipe"), bytes: 4242 });
      expect((await svc.state()).last?.state).toBe("ready");
    });

    it("is handed out for one download only", async () => {
      await answer("ready");
      pipe();
      const [first, second] = await Promise.all([svc.take(ARCHIVE), svc.take(ARCHIVE)]);
      expect([first, second].filter(Boolean)).toHaveLength(1);
      expect(await svc.take(ARCHIVE)).toBeNull();
      expect(await svc.ready(ARCHIVE)).toBeNull();
    });

    it("is not handed out for another archive, before the host is ready, once it is over, or without a pipe", async () => {
      await answer("ready");
      expect(await svc.ready(ARCHIVE)).toBeNull();
      pipe();
      expect(await svc.ready(OTHER)).toBeNull();
      await answer("done");
      expect(await svc.ready(ARCHIVE)).toBeNull();
      await answer("ready", { BYTES: "none" });
      expect(await svc.ready(ARCHIVE)).toBeNull();
      await answer("ready", { REQUEST_ID: "" });
      expect(await svc.ready(ARCHIVE)).toBeNull();
    });

    it("is never a plain file dropped at its place", async () => {
      await answer("ready");
      await writeFile(join(dir, "retrieve.pipe"), "not a pipe");
      expect(await svc.ready(ARCHIVE)).toBeNull();
    });

    it("lets the same archive be asked again while it waits to be read, and nothing else", async () => {
      await answer("ready");
      pipe();
      const state = await svc.request(ARCHIVE, FROM);
      expect(state.last).toMatchObject({ id: "abc", state: "ready" });
      await expect(svc.request(OTHER, FROM)).rejects.toMatchObject({ response: { code: "backup.retrievalBusy" } });
      await svc.take(ARCHIVE);
      await expect(svc.request(ARCHIVE, FROM)).rejects.toMatchObject({ response: { code: "backup.retrievalBusy" } });
      expect((await readdir(dir)).sort()).toEqual(["config.conf", "retrieve-status.conf", "retrieve.pipe"]);
    });
  });
});
