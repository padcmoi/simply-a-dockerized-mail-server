import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ClamavDatabasesService } from "./clamav-databases.service";
import { ClamavPublishedService } from "./clamav-published.service";
import { ClamavUpdaterService } from "./clamav-updater.service";
import { ClamdClient } from "./clamd.client";
import type { ClamavSample, ClamavStatus } from "./clamav.types";

/** How long a reading serves the supervision loop. The loop ticks every second
 *  and a signature set changes a few times a day: reading the scanner on every
 *  one of them would be a connection a second for a figure that moves once an
 *  hour at most. */
const SAMPLE_MS = 60_000;

// The one place the scanner is read. Three sources, each answering for what only
// it knows: clamd for the engine it runs and what it is doing, the files on disk
// for the databases it was given, and ClamAV's own record for what the current
// versions are. None of them can fail the page: a scanner that is down still has
// databases to show, and databases with no published version to compare to are
// still databases with a date.
@Injectable()
export class ClamavService {
  /** The last reading the supervision loop was given, and when it was taken. */
  private held: ClamavSample = { available: false, signaturesAt: null };
  private sampledAt = 0;

  constructor(
    private readonly clamd: ClamdClient,
    private readonly files: ClamavDatabasesService,
    private readonly publishedVersions: ClamavPublishedService,
    private readonly updater: ClamavUpdaterService
  ) {}

  async status(): Promise<ClamavStatus> {
    const [available, version, stats, published] = await Promise.all([
      this.clamd.ping(),
      this.clamd.version(),
      this.clamd.stats(),
      this.publishedVersions.read(),
    ]);

    const databases = this.files.read().map((database) => {
      const latest = published.versions[database.name] ?? null;
      return {
        ...database,
        published: latest,
        behind: latest !== null && database.version !== null ? Math.max(0, latest - database.version) : null,
      };
    });

    const builds = databases.map((database) => database.builtAt).filter((at) => at !== null);

    return {
      available,
      engine: {
        version: engineOf(version),
        published: published.engine,
        outdated: outdated(engineOf(version), published.engine),
      },
      signaturesAt: builds.length ? Math.max(...builds) : null,
      databases,
      stats,
    };
  }

  // The update and the reload are two halves of the same thing: freshclam
  // writes the files, clamd goes on scanning with the set it has in memory
  // until it is told to read them again. The reload is asked for right after a
  // download, so a manual update is a scanner that really is using the new
  // signatures, and it is exposed on its own as well: freshclam's own daemon
  // also downloads, and it notifies clamd through NotifyClamd, which a scanner
  // that was down at that moment never heard.
  async update() {
    const result = await this.updater.update();
    if (result.updated) await this.clamd.reload();
    return { ...result, status: await this.status() };
  }

  async reload() {
    if (!(await this.clamd.reload())) throw new ServiceUnavailableException("The antivirus is out of reach");
    return { status: await this.status() };
  }

  // What the supervision loop puts on every sample of the machine. Two things
  // only, and held for a minute: whether the scanner answers, and when its
  // newest signatures were built. The age itself is not held, it is counted
  // from that moment at every tick, so the card still moves by the second.
  async sample(): Promise<ClamavSample> {
    if (this.sampledAt && Date.now() - this.sampledAt < SAMPLE_MS) return this.held;

    const builds = this.files
      .read()
      .map((database) => database.builtAt)
      .filter((at) => at !== null);

    this.held = { available: await this.clamd.ping(), signaturesAt: builds.length ? Math.max(...builds) : null };
    this.sampledAt = Date.now();
    return this.held;
  }
}

/** clamd answers "ClamAV 1.4.6/28129/Sun Sep 20 06:26:26 2026"; the engine is
 *  the first field, the two others being the daily database the files carry. */
function engineOf(version: string | null) {
  if (!version) return null;
  const engine = version.replace(/^ClamAV\s+/, "").split("/")[0];
  return engine ? engine.trim() : null;
}

/** Compared field by field rather than as text: "1.4.10" is newer than "1.4.6",
 *  and a string comparison says the opposite. */
function outdated(running: string | null, latest: string | null) {
  if (!running || !latest) return false;

  const here = running.split(".").map(Number);
  const there = latest.split(".").map(Number);

  for (let index = 0; index < Math.max(here.length, there.length); index += 1) {
    const mine = here[index] ?? 0;
    const published = there[index] ?? 0;
    if (!Number.isFinite(mine) || !Number.isFinite(published)) return false;
    if (mine !== published) return mine < published;
  }

  return false;
}
