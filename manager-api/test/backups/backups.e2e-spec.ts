import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { HttpStatus, NotFoundException } from "@nestjs/common";
import { Readable } from "stream";
import { BackupDownloadController } from "../../src/api/backups/backup-download.controller";
import { BackupsController } from "../../src/api/backups/backups.controller";
import { ActivityLogService } from "../../src/core/activity/activity-log.service";
import { RootGuard } from "../../src/core/auth/root.guard";
import { BackupConfigService } from "../../src/core/backups/backup-config.service";
import { BackupOffsiteService } from "../../src/core/backups/backup-offsite.service";
import { BackupRetrievalService } from "../../src/core/backups/backup-retrieval.service";
import { BackupService } from "../../src/core/backups/backup.service";
import { ApiError } from "../../src/core/common/api-error";
import { buildHarness, ROOT, USER, type Harness } from "../helpers/e2e";

const base = "/api/v1/backups";
const ARCHIVE = "backup-2026-10-02.tar.gz";
const config = { time: "03:15", keepDays: 7, offsite: "bob@backup.example.com:/srv/mail", offsiteDeleteLocal: true };
const state = {
  configured: true,
  config: { ...config, dir: "./backup", timezone: "UTC", publishedAt: null },
  pending: false,
  lastRequest: null,
};

describe("BackupsController (e2e: root only + behavior)", () => {
  let h: Harness;
  const backups = {
    lastRun: vi.fn(),
    projectMounted: vi.fn(),
    listRuns: vi.fn(),
    runLog: vi.fn(),
    listFiles: vi.fn(),
    downloadLink: vi.fn(),
    openDownload: vi.fn(),
    retrievalSource: vi.fn(),
  };
  const configSvc = { state: vi.fn(), request: vi.fn() };
  const retrievalSvc = { state: vi.fn(), request: vi.fn() };
  const offsiteSvc = { state: vi.fn() };
  const listed = { pending: false, target: "bob@backup.example.com:/srv/mail", listed: true, checkedAt: "2026-10-02T22:31:00Z" };
  const idle = { pending: null, last: null };
  const asked = { pending: { id: "0b8f6f0e-5a55-4c5e-9d7b-2f3a1c9e7d10", name: ARCHIVE }, last: null };
  const activity = { record: vi.fn() };

  beforeAll(async () => {
    h = await buildHarness({
      controllers: [BackupsController, BackupDownloadController],
      providers: [
        RootGuard,
        { provide: BackupService, useValue: backups },
        { provide: BackupConfigService, useValue: configSvc },
        { provide: BackupRetrievalService, useValue: retrievalSvc },
        { provide: BackupOffsiteService, useValue: offsiteSvc },
        { provide: ActivityLogService, useValue: activity },
      ],
    });
  });
  afterAll(() => h.close());
  beforeEach(() => {
    h.cpg.reset();
    backups.lastRun.mockReset().mockResolvedValue({ id: 1, result: "success" });
    backups.projectMounted.mockReset().mockResolvedValue(true);
    backups.listRuns.mockReset().mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    backups.runLog.mockReset().mockResolvedValue({ id: 1, lines: ["a", "b"] });
    backups.listFiles.mockReset().mockResolvedValue([{ name: ARCHIVE, downloadable: true }]);
    backups.downloadLink.mockReset().mockResolvedValue({ token: "tok.sig", expiresInSeconds: 60 });
    backups.openDownload.mockReset();
    backups.retrievalSource.mockReset().mockResolvedValue({ from: config.offsite });
    offsiteSvc.state.mockReset().mockResolvedValue(listed);
    retrievalSvc.state.mockReset().mockResolvedValue(idle);
    retrievalSvc.request.mockReset().mockResolvedValue(asked);
    configSvc.state.mockReset().mockResolvedValue(state);
    configSvc.request.mockReset().mockResolvedValue({ ...state, pending: true });
    activity.record.mockReset().mockResolvedValue(undefined);
  });

  const api = () => request(h.app.getHttpServer());
  const root = () => `Bearer ${h.token(ROOT)}`;
  const user = () => `Bearer ${h.token(USER)}`;
  const attach = (t: request.Test, auth?: string) => (auth ? t.set("Authorization", auth) : t);
  const grantEverything = () => {
    h.cpg.grantGlobal("supervision", "access", "view-machine-metrics", "view-activity-log", "view-mail-logs");
    h.cpg.grantGlobal("superadmin", "access", "resize-any-domain-quota", "delete-any-domain");
    h.cpg.grantGlobal("misc", "access", "protect-resource");
  };

  const routes: { name: string; ok: number; send: (auth?: string) => request.Test }[] = [
    { name: "GET /backups", ok: 200, send: (a) => attach(api().get(base), a) },
    { name: "GET /backups/runs", ok: 200, send: (a) => attach(api().get(`${base}/runs?limit=10`), a) },
    { name: "GET /backups/runs/:id/log", ok: 200, send: (a) => attach(api().get(`${base}/runs/1/log`), a) },
    { name: "GET /backups/files", ok: 200, send: (a) => attach(api().get(`${base}/files`), a) },
    { name: "POST download-link", ok: 201, send: (a) => attach(api().post(`${base}/files/${ARCHIVE}/download-link`), a) },
    { name: "POST retrieve", ok: 201, send: (a) => attach(api().post(`${base}/files/${ARCHIVE}/retrieve`), a) },
    { name: "PUT /backups/config", ok: 200, send: (a) => attach(api().put(`${base}/config`).send(config), a) },
  ];

  describe("root only: the page and everything under it", () => {
    for (const r of routes) {
      it(`401 without a token -- ${r.name}`, async () => {
        await r.send().expect(401);
      });
      it(`403 for a non-root account -- ${r.name}`, async () => {
        await r.send(user()).expect(403);
      });
      it(`403 for a non-root account holding global permissions, no ACL opens it -- ${r.name}`, async () => {
        grantEverything();
        await r.send(user()).expect(403);
        for (const fn of Object.values(backups)) expect(fn).not.toHaveBeenCalled();
        expect(configSvc.state).not.toHaveBeenCalled();
        expect(configSvc.request).not.toHaveBeenCalled();
      });
      it(`${r.ok} for root -- ${r.name}`, async () => {
        await r.send(root()).expect(r.ok);
      });
    }
  });

  describe("consultation", () => {
    it("the overview joins the configuration state, the last run and the archives folder", async () => {
      const res = await api().get(base).set("Authorization", root()).expect(200);
      expect(res.body).toEqual({
        ...state,
        lastRun: { id: 1, result: "success" },
        projectReadable: true,
        retrieval: idle,
        offsite: listed,
      });
    });

    it("the runs list forwards the pagination", async () => {
      await api()
        .get(`${base}/runs?limit=25&offset=25&sortBy=outageSeconds&sortDir=asc`)
        .set("Authorization", root())
        .expect(200);
      expect(backups.listRuns).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25, offset: 25, sortBy: "outageSeconds", sortDir: "asc" })
      );
    });

    it("400 on a run id that is not a number", async () => {
      await api().get(`${base}/runs/abc/log`).set("Authorization", root()).expect(400);
    });
  });

  describe("configuration and download", () => {
    it("PUT config writes the request and journals it", async () => {
      const res = await api().put(`${base}/config`).set("Authorization", root()).send(config).expect(200);
      expect(configSvc.request).toHaveBeenCalledWith(config);
      expect(res.body.pending).toBe(true);
      expect(activity.record).toHaveBeenCalledWith({ action: "backup.config-requested", details: config });
    });

    it("PUT config accepts an empty off-site destination", async () => {
      await api()
        .put(`${base}/config`)
        .set("Authorization", root())
        .send({ ...config, offsite: "" })
        .expect(200);
    });

    const rejected: [string, Record<string, unknown>][] = [
      ["a time out of range", { ...config, time: "24:00" }],
      ["a time with seconds", { ...config, time: "02:30:00" }],
      ["zero backups kept", { ...config, keepDays: 0 }],
      ["1000 backups kept", { ...config, keepDays: 1000 }],
      ["a text for the backups kept", { ...config, keepDays: "5" }],
      ["a folder as off-site destination", { ...config, offsite: "/mnt/disk" }],
      ["a command in the off-site destination", { ...config, offsite: "bob@host:/srv; rm -rf /" }],
      ["a destination with an option", { ...config, offsite: "-oProxyCommand=x@host:/srv" }],
      ["a line break in the off-site destination", { ...config, offsite: "bob@host:/srv\nBACKUP_DIR=/etc" }],
      ["a text for the delete choice", { ...config, offsiteDeleteLocal: "yes" }],
      ["a missing field", { time: "02:30" }],
    ];
    for (const [name, body] of rejected) {
      it(`PUT config 400 for ${name}, nothing written`, async () => {
        await api().put(`${base}/config`).set("Authorization", root()).send(body).expect(400);
        expect(configSvc.request).not.toHaveBeenCalled();
      });
    }

    it("PUT config never forwards a folder of the archives", async () => {
      await api()
        .put(`${base}/config`)
        .set("Authorization", root())
        .send({ ...config, dir: "/etc" })
        .expect(200);
      expect(configSvc.request).toHaveBeenCalledWith(config);
    });

    it("PUT config 409 when the backup is not installed on the server, nothing journaled", async () => {
      configSvc.request.mockRejectedValue(new ApiError(HttpStatus.CONFLICT, "backup.notConfigured", "not installed"));
      const res = await api().put(`${base}/config`).set("Authorization", root()).send(config).expect(409);
      expect(res.body.code).toBe("backup.notConfigured");
      expect(activity.record).not.toHaveBeenCalled();
    });

    it("POST download-link returns the link and journals who asked", async () => {
      const res = await api().post(`${base}/files/${ARCHIVE}/download-link`).set("Authorization", root()).expect(201);
      expect(res.body).toEqual({ token: "tok.sig", expiresInSeconds: 60 });
      expect(activity.record).toHaveBeenCalledWith({
        action: "backup.download-requested",
        entity: { type: "backup-file", id: ARCHIVE, label: ARCHIVE },
      });
    });

    for (const name of ["..%2F..%2Fetc%2Fpasswd", "backup.log", "last-run.json", "backup-2026-10-02.tar.gz.sh", ".env"]) {
      it(`POST download-link 404 for ${name}, nothing signed`, async () => {
        await api().post(`${base}/files/${name}/download-link`).set("Authorization", root()).expect(404);
        expect(backups.downloadLink).not.toHaveBeenCalled();
      });
    }
  });

  describe("downloading an archive that was sent off-site, from there", () => {
    it("POST retrieve asks the host for the archive, from the place the database holds, and journals it", async () => {
      const res = await api().post(`${base}/files/${ARCHIVE}/retrieve`).set("Authorization", root()).expect(201);
      expect(res.body).toEqual(asked);
      expect(backups.retrievalSource).toHaveBeenCalledWith(ARCHIVE);
      expect(retrievalSvc.request).toHaveBeenCalledWith(ARCHIVE, config.offsite);
      expect(activity.record).toHaveBeenCalledWith({
        action: "backup.retrieval-requested",
        entity: { type: "backup-file", id: ARCHIVE, label: ARCHIVE },
        details: { from: config.offsite },
      });
    });

    it("POST retrieve never takes the place from the caller", async () => {
      await api()
        .post(`${base}/files/${ARCHIVE}/retrieve`)
        .set("Authorization", root())
        .send({ from: "eve@evil.example.com:/tmp", bytes: 1 })
        .expect(201);
      expect(retrievalSvc.request).toHaveBeenCalledWith(ARCHIVE, config.offsite);
    });

    for (const name of ["..%2F..%2Fetc%2Fpasswd", "backup.log", "backup-2026-10-02.tar.gz.sh", ".env"]) {
      it(`POST retrieve 404 for ${name}, nothing asked`, async () => {
        await api().post(`${base}/files/${name}/retrieve`).set("Authorization", root()).expect(404);
        expect(backups.retrievalSource).not.toHaveBeenCalled();
        expect(retrievalSvc.request).not.toHaveBeenCalled();
      });
    }

    it("POST retrieve 404 for an archive that is not kept off-site, nothing asked nor journaled", async () => {
      backups.retrievalSource.mockRejectedValue(new ApiError(HttpStatus.NOT_FOUND, "backup.fileUnavailable", "nowhere"));
      const res = await api().post(`${base}/files/${ARCHIVE}/retrieve`).set("Authorization", root()).expect(404);
      expect(res.body.code).toBe("backup.fileUnavailable");
      expect(retrievalSvc.request).not.toHaveBeenCalled();
      expect(activity.record).not.toHaveBeenCalled();
    });

    for (const code of ["backup.notConfigured", "backup.retrievalBusy"] as const) {
      it(`POST retrieve 409 ${code}, nothing journaled`, async () => {
        retrievalSvc.request.mockRejectedValue(new ApiError(HttpStatus.CONFLICT, code, "no"));
        const res = await api().post(`${base}/files/${ARCHIVE}/retrieve`).set("Authorization", root()).expect(409);
        expect(res.body.code).toBe(code);
        expect(activity.record).not.toHaveBeenCalled();
      });
    }
  });

  describe("GET /backups/download/:token (the link is the credential)", () => {
    it("streams the archive without a token", async () => {
      backups.openDownload.mockResolvedValue({ name: ARCHIVE, size: 5, stream: Readable.from([Buffer.from("hello")]) });
      const res = await api().get(`${base}/download/tok.sig`).buffer(true).expect(200);
      expect(backups.openDownload).toHaveBeenCalledWith("tok.sig");
      expect(res.headers["content-disposition"]).toBe(`attachment; filename="${ARCHIVE}"`);
      expect(res.headers["content-type"]).toContain("application/gzip");
      expect(res.headers["content-length"]).toBe("5");
    });

    it("404 on a link the service refuses", async () => {
      backups.openDownload.mockRejectedValue(new NotFoundException("expired"));
      await api().get(`${base}/download/bad`).expect(404);
    });
  });
});
