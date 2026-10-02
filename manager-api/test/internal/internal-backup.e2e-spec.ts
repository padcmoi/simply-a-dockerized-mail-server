import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { InternalBackupController } from "../../src/api/internal/internal-backup.controller";
import { LoopbackGuard } from "../../src/core/auth/loopback.guard";
import { BackupService } from "../../src/core/backups/backup.service";
import { buildHarness, ROOT, type Harness } from "../helpers/e2e";

const url = "/api/v1/internal/backup/report";
const report = {
  run: {
    startedAt: "2026-10-02T02:30:01Z",
    finishedAt: "2026-10-02T02:30:56Z",
    result: "success",
    step: "done",
    error: "",
    durationSeconds: 55,
    outageSeconds: 28,
    archive: "backup-2026-10-02.tar.gz",
    archiveBytes: 212731507,
    storedIn: "/srv/mail/backup",
    offsiteTarget: "",
    offsiteSent: false,
    log: ["2026-10-02 02:30:01 backup started"],
  },
  archivesDir: "/srv/mail/backup",
  archivesProjectDir: "backup",
  localFiles: [{ name: "backup-2026-10-02.tar.gz", bytes: 212731507, modifiedAt: "2026-10-02T02:30:50Z" }],
  offsiteDeleted: [],
};

describe("InternalBackupController (e2e: machine-only route)", () => {
  let h: Harness;
  const backups = { ingest: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [InternalBackupController],
      providers: [LoopbackGuard, { provide: BackupService, useValue: backups }],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    backups.ingest.mockReset().mockResolvedValue(undefined);
  });

  const api = () => request(h.app.getHttpServer());

  it("204 from the machine, without a token, and stores the report", async () => {
    await api().post(url).send(report).expect(204);
    expect(backups.ingest).toHaveBeenCalledWith(report);
  });

  it("204 for archives kept outside the project: a full path, no place inside it", async () => {
    await api()
      .post(url)
      .send({ ...report, archivesDir: "/mnt/disk/backups", archivesProjectDir: "" })
      .expect(204);
  });

  it("204 for a folder deeper in the project", async () => {
    await api()
      .post(url)
      .send({ ...report, archivesDir: "/srv/mail/data/saves", archivesProjectDir: "data/saves" })
      .expect(204);
  });

  it("204 for a run that was interrupted, reported by the next one", async () => {
    const interrupted = {
      ...report,
      run: {
        ...report.run,
        result: "failed",
        step: "unknown",
        error: "this run was interrupted before it could end",
        archive: "",
        archiveBytes: 0,
      },
    };
    await api().post(url).send(interrupted).expect(204);
  });

  it("204 for a failed run with no archive", async () => {
    const failed = {
      ...report,
      run: { ...report.run, result: "failed", step: "check", error: "not enough disk space", archive: "", archiveBytes: 0 },
    };
    await api().post(url).send(failed).expect(204);
  });

  for (const header of ["X-Forwarded-For", "X-Real-IP", "Forwarded"]) {
    it(`403 when relayed by a proxy (${header}), nothing stored`, async () => {
      await api().post(url).set(header, "203.0.113.7").send(report).expect(403);
      expect(backups.ingest).not.toHaveBeenCalled();
    });
  }

  it("403 through a proxy even for a root token", async () => {
    await api()
      .post(url)
      .set("X-Forwarded-For", "127.0.0.1")
      .set("Authorization", `Bearer ${h.token(ROOT)}`)
      .send(report)
      .expect(403);
  });

  const rejected: [string, unknown][] = [
    ["an empty body", {}],
    ["an unknown result", { ...report, run: { ...report.run, result: "ok" } }],
    ["an unknown step", { ...report, run: { ...report.run, step: "elsewhere" } }],
    ["an archive name that is a path", { ...report, run: { ...report.run, archive: "../../etc/passwd" } }],
    [
      "a file name that is not an archive",
      { ...report, localFiles: [{ name: "backup.log", bytes: 1, modifiedAt: "2026-10-02T02:30:50Z" }] },
    ],
    ["a listed archive with no date", { ...report, localFiles: [{ name: "backup-2026-10-02.tar.gz", bytes: 1 }] }],
    ["no word on where the archives are", { run: report.run, localFiles: report.localFiles, offsiteDeleted: [] }],
    ["an archives folder that is not a full path", { ...report, archivesDir: "backup" }],
    ["a place in the project that climbs out of it", { ...report, archivesProjectDir: "../../etc" }],
    ["a place in the project that hides a climb", { ...report, archivesProjectDir: "backup/../.." }],
    ["a place in the project given as a full path", { ...report, archivesProjectDir: "/etc" }],
    ["a negative duration", { ...report, run: { ...report.run, durationSeconds: -1 } }],
    ["a date that is not one", { ...report, run: { ...report.run, startedAt: "yesterday" } }],
    ["a log of 401 lines", { ...report, run: { ...report.run, log: Array.from({ length: 401 }, () => "x") } }],
  ];
  for (const [name, body] of rejected) {
    it(`400 for ${name}, nothing stored`, async () => {
      await api()
        .post(url)
        .send(body as object)
        .expect(400);
      expect(backups.ingest).not.toHaveBeenCalled();
    });
  }
});
