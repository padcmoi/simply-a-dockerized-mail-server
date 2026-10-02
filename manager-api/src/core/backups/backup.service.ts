import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHmac, timingSafeEqual } from "crypto";
import { createReadStream } from "fs";
import { lstat, readdir, stat } from "fs/promises";
import { join, resolve, sep } from "path";
import type { Readable } from "stream";
import { In, LessThan, Like, Not, Repository } from "typeorm";
import { ApiError } from "../common/api-error";
import { resolveSortColumn, type PaginatedResult, type PaginationQuery } from "../common/pagination.validation";
import { BackupFile } from "../entities/backup-file.entity";
import { BackupRun } from "../entities/backup-run.entity";
import { BackupOffsiteService } from "./backup-offsite.service";
import { BackupRetrievalService } from "./backup-retrieval.service";
import { BACKUP_ARCHIVE_PATTERN, BACKUP_OFFSITE_PATTERN, type BackupReportDto } from "./backup.validation";

export const BACKUP_PROJECT_PATH = "/host/project";
export const DOWNLOAD_LINK_SECONDS = 60;

const DEFAULT_FOLDER = "backup";
const RUNS_KEPT_DAYS = 180;
const RUN_SORT = ["startedAt", "result", "durationSeconds", "outageSeconds", "archiveBytes"] as const;

// Where an archive is kept is stored with it: `localDir`, its folder on the
// server, and `localProjectDir`, that same folder as a path inside the project
// when it lies in it. The project is mounted read only, so the path is looked
// up on every call: an archive, or its whole folder, that is moved away,
// deleted or put back is seen at once, with no restart. A folder outside the
// project cannot be looked at: its archives keep what the last backup reported.
//   readable  the folder is there
//   absent    the project holds no such folder: its archives are gone
//   unknown   it cannot be looked at
type FolderState = "readable" | "absent" | "unknown";

export interface BackupFileView extends BackupFile {
  verifiable: boolean;
  downloadable: boolean;
  retrievable: boolean;
  offsitePresent: boolean | null;
  offsiteCheckedAt: string | null;
}

@Injectable()
export class BackupService {
  protected readonly projectDir: string = BACKUP_PROJECT_PATH;

  constructor(
    @InjectRepository(BackupRun) private readonly runs: Repository<BackupRun>,
    @InjectRepository(BackupFile) private readonly files: Repository<BackupFile>,
    private readonly retrieval: BackupRetrievalService,
    private readonly offsite: BackupOffsiteService
  ) {}

  async ingest(report: BackupReportDto) {
    const { run } = report;
    const startedAt = new Date(run.startedAt);
    const finishedAt = new Date(run.finishedAt);
    await this.runs.upsert(
      {
        startedAt,
        finishedAt,
        result: run.result,
        step: run.step,
        error: run.error,
        durationSeconds: run.durationSeconds,
        outageSeconds: run.outageSeconds,
        archive: run.archive,
        archiveBytes: run.archiveBytes,
        storedIn: run.storedIn,
        offsiteTarget: run.offsiteTarget,
        offsiteSent: run.offsiteSent ? 1 : 0,
        log: run.log.join("\n"),
      },
      ["startedAt"]
    );

    const local = new Map(report.localFiles.map((file) => [file.name, file]));
    const place = { localDir: report.archivesDir, localProjectDir: report.archivesProjectDir || null };
    if (run.archive) {
      const known = await this.files.findOne({ where: { name: run.archive } });
      await this.files.save({
        name: run.archive,
        bytes: run.archiveBytes,
        createdAt: finishedAt,
        ...place,
        localPresent: local.has(run.archive) ? 1 : 0,
        localDeletedAt: local.has(run.archive) ? null : finishedAt,
        offsiteTarget: run.offsiteSent ? run.offsiteTarget : (known?.offsiteTarget ?? ""),
        offsiteSentAt: run.offsiteSent ? finishedAt : (known?.offsiteSentAt ?? null),
        offsiteDeletedAt: run.offsiteSent ? null : (known?.offsiteDeletedAt ?? null),
      });
    }
    for (const [name, { bytes, modifiedAt }] of local) {
      if (name === run.archive) continue;
      const known = await this.files.findOne({ where: { name } });
      if (known) await this.files.update({ name }, { ...place, bytes, localPresent: 1, localDeletedAt: null });
      else await this.files.save({ ...place, name, bytes, createdAt: new Date(modifiedAt), localPresent: 1 });
    }
    const names = [...local.keys()];
    await this.files.update(
      { localPresent: 1, localDir: report.archivesDir, ...(names.length ? { name: Not(In(names)) } : {}) },
      { localPresent: 0, localDeletedAt: finishedAt }
    );
    if (report.offsiteDeleted.length) {
      await this.files.update({ name: In(report.offsiteDeleted) }, { offsiteDeletedAt: finishedAt });
    }
    await this.runs.delete({ startedAt: LessThan(new Date(Date.now() - RUNS_KEPT_DAYS * 86_400_000)) });
  }

  async listRuns(query: PaginationQuery): Promise<PaginatedResult<BackupRun>> {
    const sort = resolveSortColumn(query.sortBy, RUN_SORT, "startedAt");
    const term = query.search ? Like(`%${query.search}%`) : undefined;
    const [items, total] = await this.runs.findAndCount({
      where: term ? [{ archive: term }, { result: term }, { error: term }] : undefined,
      order: { [sort]: query.sortDir === "asc" ? "ASC" : "DESC" },
      skip: query.offset,
      take: query.limit ?? 10,
    });
    return { items, total };
  }

  async runLog(id: number) {
    const run = await this.runs.createQueryBuilder("run").addSelect("run.log").where("run.id = :id", { id }).getOne();
    if (!run) throw new NotFoundException("No such backup run");
    return { id: run.id, startedAt: run.startedAt, lines: run.log ? run.log.split("\n") : [] };
  }

  lastRun() {
    return this.runs.findOne({ where: {}, order: { startedAt: "DESC" } });
  }

  async listFiles(): Promise<BackupFileView[]> {
    await this.reconcile();
    const mounted = await this.projectMounted();
    const rows = await this.files.find({ order: { name: "DESC" } });
    const sent = rows.some((row) => this.keptOffsite(row));
    if (sent) await this.offsite.refresh();
    const listing = sent ? await this.offsite.listing() : null;
    return Promise.all(
      rows.map(async (row) => {
        const state = mounted && row.localProjectDir ? await this.folderState(row.localProjectDir) : "unknown";
        const downloadable = state === "readable" && (await this.sizeOf(row)) !== null;
        const listed = listing !== null && this.keptOffsite(row) && listing.target === row.offsiteTarget ? listing : null;
        const offsitePresent = listed ? listed.names.has(row.name) : null;
        return {
          ...row,
          verifiable: state !== "unknown",
          downloadable,
          retrievable: !downloadable && state !== "unknown" && this.keptOffsite(row) && offsitePresent !== false,
          offsitePresent,
          offsiteCheckedAt: listed ? listed.checkedAt : null,
        };
      })
    );
  }

  async downloadLink(name: string) {
    const row = await this.files.findOne({ where: { name } });
    if (!row || ((await this.sizeOf(row)) === null && (await this.retrieval.ready(name)) === null)) {
      throw new ApiError(HttpStatus.NOT_FOUND, "backup.fileUnavailable", "This archive is not on the server anymore");
    }
    const expires = Math.floor(Date.now() / 1000) + DOWNLOAD_LINK_SECONDS;
    const payload = Buffer.from(`${name}|${expires}`).toString("base64url");
    return { token: `${payload}.${this.sign(payload)}`, expiresInSeconds: DOWNLOAD_LINK_SECONDS };
  }

  async retrievalSource(name: string) {
    const row = await this.files.findOne({ where: { name } });
    const state = row?.localProjectDir && (await this.projectMounted()) ? await this.folderState(row.localProjectDir) : "unknown";
    if (!row || state === "unknown" || !this.keptOffsite(row)) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "backup.fileUnavailable",
        "This archive is neither on the server nor kept off-site"
      );
    }
    return { from: row.offsiteTarget };
  }

  async openDownload(token: string): Promise<{ name: string; size: number; stream: Readable }> {
    const [payload, signature, ...rest] = token.split(".");
    const expected = payload ? this.sign(payload) : "";
    if (
      !payload ||
      !signature ||
      rest.length ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new NotFoundException("Invalid download link");
    }
    const [name, expires] = Buffer.from(payload, "base64url").toString("utf8").split("|");
    if (!BACKUP_ARCHIVE_PATTERN.test(name ?? "") || !(Number(expires) > Date.now() / 1000)) {
      throw new NotFoundException("This download link has expired");
    }
    const row = await this.files.findOne({ where: { name } });
    const path = row?.localProjectDir ? this.pathOf(row.localProjectDir, name) : null;
    const size = row ? await this.sizeOf(row) : null;
    if (path !== null && size !== null) return { name, size, stream: createReadStream(path) };
    const offsite = row ? await this.retrieval.take(name) : null;
    if (offsite === null) throw new NotFoundException("This archive is not on the server anymore");
    return { name, size: offsite.bytes, stream: createReadStream(offsite.path) };
  }

  async projectMounted() {
    const info = await stat(this.projectDir).catch(() => null);
    return info?.isDirectory() === true;
  }

  private async reconcile() {
    if (!(await this.projectMounted())) return;
    const rows = await this.files.find();
    const known = new Set(rows.map((row) => row.name));
    const folders = new Set([DEFAULT_FOLDER, ...rows.flatMap((row) => (row.localProjectDir ? [row.localProjectDir] : []))]);
    const now = new Date();
    for (const folder of folders) {
      const dir = this.pathOf(folder);
      const state = await this.folderState(folder);
      if (dir === null || state === "unknown") continue;
      const names = state === "readable" ? await readdir(dir).catch(() => null) : [];
      if (names === null) continue;
      const onDisk = new Set(names.filter((name) => BACKUP_ARCHIVE_PATTERN.test(name)));
      const kept = rows.filter((row) => row.localProjectDir === folder);
      for (const row of kept) {
        const there = onDisk.has(row.name);
        if (there && !row.localPresent) {
          await this.files.update({ name: row.name }, { localPresent: 1, localDeletedAt: null });
        } else if (!there && row.localPresent) {
          await this.files.update({ name: row.name }, { localPresent: 0, localDeletedAt: now });
        }
      }
      for (const name of onDisk) {
        if (known.has(name)) continue;
        const info = await stat(join(dir, name)).catch(() => null);
        if (!info?.isFile()) continue;
        known.add(name);
        await this.files.save({
          name,
          bytes: info.size,
          createdAt: info.mtime,
          localPresent: 1,
          localDir: kept[0]?.localDir ?? "",
          localProjectDir: folder,
        });
      }
    }
  }

  private keptOffsite(row: Pick<BackupFile, "offsiteTarget" | "offsiteSentAt" | "offsiteDeletedAt">) {
    return row.offsiteSentAt !== null && row.offsiteDeletedAt === null && BACKUP_OFFSITE_PATTERN.test(row.offsiteTarget);
  }

  private async folderState(folder: string): Promise<FolderState> {
    const dir = this.pathOf(folder);
    if (dir === null) return "unknown";
    const entry = await lstat(dir).catch(() => null);
    if (entry === null) return "absent";
    const target = await stat(dir).catch(() => null);
    if (target?.isDirectory()) return "readable";
    return entry.isSymbolicLink() ? "unknown" : "absent";
  }

  private pathOf(folder: string, name = "") {
    const root = resolve(this.projectDir);
    const full = resolve(root, folder, name);
    return full.startsWith(`${root}${sep}`) ? full : null;
  }

  private async sizeOf(row: Pick<BackupFile, "name" | "localProjectDir">): Promise<number | null> {
    if (!row.localProjectDir || !BACKUP_ARCHIVE_PATTERN.test(row.name)) return null;
    const path = this.pathOf(row.localProjectDir, row.name);
    const info = path === null ? null : await stat(path).catch(() => null);
    return info?.isFile() ? info.size : null;
  }

  private sign(payload: string) {
    return createHmac("sha256", `backup-download:${process.env.MANAGER_JWT_ACCESS_SECRET ?? ""}`)
      .update(payload)
      .digest("base64url");
  }
}
