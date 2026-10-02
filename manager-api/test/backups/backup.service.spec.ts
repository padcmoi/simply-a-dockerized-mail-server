import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { Repository } from "typeorm";
import { BackupService } from "../../src/core/backups/backup.service";
import type { BackupReportDto } from "../../src/core/backups/backup.validation";
import type { BackupFile } from "../../src/core/entities/backup-file.entity";
import type { BackupRun } from "../../src/core/entities/backup-run.entity";
import { repoMock, type Loose } from "../helpers/mocks";

class TestBackupService extends BackupService {
  constructor(
    runs: Repository<BackupRun>,
    files: Repository<BackupFile>,
    protected readonly projectDir: string
  ) {
    super(runs, files);
  }
}

const TODAY = "backup-2026-10-02.tar.gz";
const YESTERDAY = "backup-2026-10-01.tar.gz";
const PLACE = { localDir: "/srv/mail/backup", localProjectDir: "backup" };

const reportOf = (over: Partial<BackupReportDto["run"]> = {}, rest: Partial<BackupReportDto> = {}): BackupReportDto => ({
  run: {
    startedAt: "2026-10-02T02:30:01Z",
    finishedAt: "2026-10-02T02:30:56Z",
    result: "success",
    step: "done",
    error: "",
    durationSeconds: 55,
    outageSeconds: 28,
    archive: TODAY,
    archiveBytes: 100,
    storedIn: "/srv/mail/backup",
    offsiteTarget: "",
    offsiteSent: false,
    log: ["one", "two"],
    ...over,
  },
  archivesDir: "/srv/mail/backup",
  archivesProjectDir: "backup",
  localFiles: [{ name: TODAY, bytes: 100, modifiedAt: "2026-10-02T02:30:50Z" }],
  offsiteDeleted: [],
  ...rest,
});

const twoFiles = {
  localFiles: [
    { name: TODAY, bytes: 100, modifiedAt: "2026-10-02T02:30:50Z" },
    { name: YESTERDAY, bytes: 90, modifiedAt: "2026-10-01T19:30:59Z" },
  ],
};

const row = (over: Partial<BackupFile> = {}) => ({ name: TODAY, bytes: 1, localPresent: 1, ...PLACE, ...over }) as BackupFile;

describe("BackupService", () => {
  let project: string;
  let dir: string;
  let svc: TestBackupService;
  let runs: Loose<Repository<BackupRun>>;
  let files: Loose<Repository<BackupFile>>;

  beforeEach(async () => {
    project = await mkdtemp(join(tmpdir(), "backup-project-"));
    dir = join(project, "backup");
    await mkdir(dir);
    runs = repoMock<BackupRun>();
    files = repoMock<BackupFile>();
    files.findOne.mockResolvedValue(null);
    files.find.mockResolvedValue([]);
    svc = new TestBackupService(runs, files, project);
  });
  afterEach(() => rm(project, { recursive: true, force: true }));

  describe("ingest", () => {
    it("stores the run once, keyed by the moment it started, with its log", async () => {
      await svc.ingest(reportOf());
      expect(runs.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          startedAt: new Date("2026-10-02T02:30:01Z"),
          result: "success",
          outageSeconds: 28,
          log: "one\ntwo",
        }),
        ["startedAt"]
      );
    });

    it("records the archive of the run with the place it is kept in", async () => {
      await svc.ingest(reportOf());
      expect(files.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: TODAY, bytes: 100, ...PLACE, localPresent: 1, localDeletedAt: null, offsiteSentAt: null })
      );
    });

    it("records where an archive kept outside the project is, with no path it could look at", async () => {
      await svc.ingest(reportOf({}, { archivesDir: "/mnt/disk/backups", archivesProjectDir: "" }));
      expect(files.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: TODAY, localDir: "/mnt/disk/backups", localProjectDir: null, localPresent: 1 })
      );
    });

    it("records an archive sent off-site and deleted here", async () => {
      await svc.ingest(reportOf({ offsiteTarget: "bob@host:/srv", offsiteSent: true }, { localFiles: [] }));
      const finished = new Date("2026-10-02T02:30:56Z");
      expect(files.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: TODAY,
          localPresent: 0,
          localDeletedAt: finished,
          offsiteTarget: "bob@host:/srv",
          offsiteSentAt: finished,
          offsiteDeletedAt: null,
        })
      );
    });

    it("marks as deleted the archives of that folder the server no longer lists, and only those", async () => {
      await svc.ingest(reportOf({}, twoFiles));
      const sweep = files.update.mock.calls.find(([, set]) => (set as { localPresent?: number }).localPresent === 0);
      expect(sweep?.[0]).toMatchObject({ localPresent: 1, localDir: "/srv/mail/backup" });
      expect(JSON.stringify(sweep?.[0])).toContain(TODAY);
      expect(JSON.stringify(sweep?.[0])).toContain(YESTERDAY);
    });

    it("learns an archive it had never heard of from the listing, with its place and its own date", async () => {
      await svc.ingest(reportOf({}, twoFiles));
      expect(files.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: YESTERDAY,
          bytes: 90,
          localPresent: 1,
          createdAt: new Date("2026-10-01T19:30:59Z"),
          ...PLACE,
        })
      );
    });

    it("records the archives the rotation deleted on the off-site server", async () => {
      await svc.ingest(reportOf({}, { offsiteDeleted: [YESTERDAY] }));
      expect(JSON.stringify(files.update.mock.calls)).toContain("offsiteDeletedAt");
    });

    it("stores a failed run without touching any archive row for it", async () => {
      await svc.ingest(
        reportOf({ result: "failed", step: "check", error: "not enough disk space", archive: "", archiveBytes: 0 })
      );
      expect(runs.upsert).toHaveBeenCalledWith(expect.objectContaining({ result: "failed", archive: "" }), ["startedAt"]);
      expect(files.save).not.toHaveBeenCalledWith(expect.objectContaining({ name: "" }));
    });

    it("prunes the runs older than 180 days", async () => {
      await svc.ingest(reportOf());
      expect(runs.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("download links", () => {
    beforeEach(async () => {
      await writeFile(join(dir, TODAY), "archive-bytes");
      files.findOne.mockResolvedValue(row({ bytes: 13 }));
    });

    it("opens the archive named by a fresh link, at the place the database holds for it", async () => {
      const { token, expiresInSeconds } = await svc.downloadLink(TODAY);
      expect(expiresInSeconds).toBe(60);
      const file = await svc.openDownload(token);
      expect(file.name).toBe(TODAY);
      expect(file.size).toBe(13);
      file.stream.destroy();
    });

    it("refuses a link for an archive the database does not know", async () => {
      files.findOne.mockResolvedValue(null);
      await expect(svc.downloadLink(TODAY)).rejects.toMatchObject({ status: 404 });
    });

    it("refuses a link for an archive that is not at its place anymore", async () => {
      await rm(join(dir, TODAY));
      await expect(svc.downloadLink(TODAY)).rejects.toMatchObject({ status: 404 });
    });

    it("refuses a link for an archive kept outside the project, which it cannot read", async () => {
      files.findOne.mockResolvedValue(row({ localDir: "/mnt/disk/backups", localProjectDir: null }));
      await expect(svc.downloadLink(TODAY)).rejects.toMatchObject({ status: 404 });
    });

    it("never reads outside the project, whatever place the database holds", async () => {
      for (const localProjectDir of ["..", "../..", "/etc", "backup/../../.."]) {
        files.findOne.mockResolvedValue(row({ localProjectDir }));
        await expect(svc.downloadLink(TODAY), localProjectDir).rejects.toMatchObject({ status: 404 });
      }
    });

    it("hands out nothing once the folder is moved away, even with a link made before", async () => {
      const { token } = await svc.downloadLink(TODAY);
      await rename(dir, join(project, "moved-elsewhere"));
      await expect(svc.downloadLink(TODAY)).rejects.toMatchObject({ status: 404 });
      await expect(svc.openDownload(token)).rejects.toMatchObject({ status: 404 });
    });

    it("refuses a link whose signature was changed", async () => {
      const { token } = await svc.downloadLink(TODAY);
      await expect(svc.openDownload(`${token.slice(0, -2)}AA`)).rejects.toMatchObject({ status: 404 });
    });

    it("refuses a link whose payload names another file under the same signature", async () => {
      const { token } = await svc.downloadLink(TODAY);
      const forged = Buffer.from("../.env|9999999999").toString("base64url");
      await expect(svc.openDownload(`${forged}.${token.split(".")[1]}`)).rejects.toMatchObject({ status: 404 });
    });

    it("refuses a link after it expired", async () => {
      const { token } = await svc.downloadLink(TODAY);
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 61_000);
      await expect(svc.openDownload(token)).rejects.toMatchObject({ status: 404 });
      vi.useRealTimers();
    });

    it("refuses garbage", async () => {
      for (const token of ["", "x", "a.b.c", "....", "a."]) {
        await expect(svc.openDownload(token)).rejects.toMatchObject({ status: 404 });
      }
    });
  });

  describe("an archive kept off-site can be brought back", () => {
    const SENT = {
      offsiteTarget: "bob@backup.example.com:/srv/mail",
      offsiteSentAt: new Date("2026-10-02T02:31:00Z"),
      offsiteDeletedAt: null,
    };

    it("says so for an archive that is not here anymore but still kept off-site, and only for it", async () => {
      await writeFile(join(dir, YESTERDAY), "x");
      files.find.mockResolvedValue([
        row({ localPresent: 0, ...SENT }),
        row({ name: YESTERDAY, ...SENT }),
        row({ name: "backup-2026-09-30.tar.gz", localPresent: 0, ...SENT, offsiteDeletedAt: new Date() }),
        row({
          name: "backup-2026-09-29.tar.gz",
          localPresent: 0,
          offsiteSentAt: null,
          offsiteDeletedAt: null,
          offsiteTarget: "",
        }),
        row({ name: "backup-2026-09-28.tar.gz", localPresent: 0, ...SENT, offsiteTarget: "bob@host:/srv; rm -rf /" }),
        row({ name: "backup-2026-09-27.tar.gz", localPresent: 0, ...SENT, localProjectDir: null }),
      ]);
      const rows = await svc.listFiles();
      expect(rows.map((file) => [file.name, file.downloadable, file.retrievable])).toEqual([
        [TODAY, false, true],
        [YESTERDAY, true, false],
        ["backup-2026-09-30.tar.gz", false, false],
        ["backup-2026-09-29.tar.gz", false, false],
        ["backup-2026-09-28.tar.gz", false, false],
        ["backup-2026-09-27.tar.gz", false, false],
      ]);
    });

    it("gives the place the database holds for it, and its size", async () => {
      files.findOne.mockResolvedValue(row({ bytes: 4242, localPresent: 0, ...SENT }));
      expect(await svc.retrievalSource(TODAY)).toEqual({ from: SENT.offsiteTarget, bytes: 4242 });
    });

    for (const [why, over] of [
      ["was never sent off-site", { offsiteSentAt: null, offsiteTarget: "" }],
      ["was deleted off-site by the rotation", { ...SENT, offsiteDeletedAt: new Date() }],
      ["holds a place that is not user@host:/path", { ...SENT, offsiteTarget: "bob@host:/srv; rm -rf /" }],
      ["is kept outside the project, where it could not be read once back", { ...SENT, localProjectDir: null }],
    ] as const) {
      it(`refuses an archive that ${why}`, async () => {
        files.findOne.mockResolvedValue(row({ localPresent: 0, ...over }));
        await expect(svc.retrievalSource(TODAY)).rejects.toMatchObject({
          response: { code: "backup.fileUnavailable" },
          status: 404,
        });
      });
    }

    it("refuses an archive the database does not know", async () => {
      files.findOne.mockResolvedValue(null);
      await expect(svc.retrievalSource(TODAY)).rejects.toMatchObject({
        response: { code: "backup.fileUnavailable" },
        status: 404,
      });
    });
  });

  describe("files: presence is what is found at the place the database holds", () => {
    it("says which archives are there and can be handed out", async () => {
      await writeFile(join(dir, TODAY), "x");
      files.find.mockResolvedValue([row(), row({ name: YESTERDAY, localPresent: 0 })]);
      const rows = await svc.listFiles();
      expect(rows.map((file) => [file.name, file.verifiable, file.downloadable])).toEqual([
        [TODAY, true, true],
        [YESTERDAY, true, false],
      ]);
      expect(files.update).not.toHaveBeenCalled();
    });

    it("records as deleted an archive that left its folder, moved or deleted by hand", async () => {
      files.find.mockResolvedValue([row()]);
      await svc.listFiles();
      expect(files.update).toHaveBeenCalledWith({ name: TODAY }, { localPresent: 0, localDeletedAt: expect.any(Date) });
    });

    it("records as present again an archive that came back", async () => {
      await writeFile(join(dir, TODAY), "x");
      files.find.mockResolvedValue([row({ localPresent: 0, localDeletedAt: new Date() })]);
      await svc.listFiles();
      expect(files.update).toHaveBeenCalledWith({ name: TODAY }, { localPresent: 1, localDeletedAt: null });
    });

    it("records every archive as deleted once their folder is moved away from its place", async () => {
      await writeFile(join(dir, TODAY), "x");
      await writeFile(join(dir, YESTERDAY), "x");
      files.find.mockResolvedValue([row(), row({ name: YESTERDAY })]);
      await rename(dir, join(project, "moved-elsewhere"));
      const rows = await svc.listFiles();
      expect(files.update).toHaveBeenCalledWith({ name: TODAY }, { localPresent: 0, localDeletedAt: expect.any(Date) });
      expect(files.update).toHaveBeenCalledWith({ name: YESTERDAY }, { localPresent: 0, localDeletedAt: expect.any(Date) });
      expect(rows.every((file) => file.verifiable && !file.downloadable)).toBe(true);
    });

    it("sees the archives again as soon as a folder is back at that place, whichever folder it is", async () => {
      await writeFile(join(dir, TODAY), "x");
      const away = join(project, "moved-elsewhere");
      await rename(dir, away);
      await mkdir(dir);
      await rm(dir, { recursive: true });
      await rename(away, dir);
      files.find.mockResolvedValue([row({ localPresent: 0, localDeletedAt: new Date() })]);
      const rows = await svc.listFiles();
      expect(files.update).toHaveBeenCalledWith({ name: TODAY }, { localPresent: 1, localDeletedAt: null });
      expect(rows[0]?.downloadable).toBe(true);
    });

    it("looks for each archive in its own folder", async () => {
      await mkdir(join(project, "data", "saves"), { recursive: true });
      await writeFile(join(project, "data", "saves", YESTERDAY), "x");
      files.find.mockResolvedValue([
        row(),
        row({ name: YESTERDAY, localDir: "/srv/mail/data/saves", localProjectDir: "data/saves" }),
      ]);
      const rows = await svc.listFiles();
      expect(files.update).toHaveBeenCalledTimes(1);
      expect(files.update).toHaveBeenCalledWith({ name: TODAY }, { localPresent: 0, localDeletedAt: expect.any(Date) });
      expect(rows.map((file) => [file.name, file.downloadable])).toEqual([
        [TODAY, false],
        [YESTERDAY, true],
      ]);
    });

    it("leaves alone an archive kept outside the project, and says it could not check it", async () => {
      files.find.mockResolvedValue([row({ localDir: "/mnt/disk/backups", localProjectDir: null })]);
      const rows = await svc.listFiles();
      expect(files.update).not.toHaveBeenCalled();
      expect(rows[0]).toMatchObject({ localPresent: 1, verifiable: false, downloadable: false });
    });

    it("learns an archive found in a known folder that no run reported, and ignores every other file", async () => {
      await writeFile(join(dir, TODAY), "x");
      await writeFile(join(dir, YESTERDAY), "12345");
      await writeFile(join(dir, "backup.log"), "x");
      await writeFile(join(dir, "manual-dump.sql"), "x");
      files.find.mockResolvedValue([row()]);
      await svc.listFiles();
      expect(files.save).toHaveBeenCalledTimes(1);
      expect(files.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: YESTERDAY, bytes: 5, localPresent: 1, ...PLACE, createdAt: expect.any(Date) })
      );
    });

    it("treats a file sitting where the folder should be as no folder", async () => {
      await rm(dir, { recursive: true });
      await writeFile(dir, "not a folder");
      files.find.mockResolvedValue([row()]);
      await svc.listFiles();
      expect(files.update).toHaveBeenCalledWith({ name: TODAY }, { localPresent: 0, localDeletedAt: expect.any(Date) });
    });

    it("changes nothing when it cannot look: the project is not mounted", async () => {
      await rm(project, { recursive: true });
      files.find.mockResolvedValue([row()]);
      expect(await svc.projectMounted()).toBe(false);
      const rows = await svc.listFiles();
      expect(files.update).not.toHaveBeenCalled();
      expect(files.save).not.toHaveBeenCalled();
      expect(rows[0]).toMatchObject({ localPresent: 1, verifiable: false, downloadable: false });
    });

    it("changes nothing when the folder is a link leading outside what it sees", async () => {
      await rm(dir, { recursive: true });
      await symlink("/nonexistent/another-disk/backup", dir);
      files.find.mockResolvedValue([row()]);
      const rows = await svc.listFiles();
      expect(files.update).not.toHaveBeenCalled();
      expect(rows[0]).toMatchObject({ verifiable: false, downloadable: false });
    });
  });
});
