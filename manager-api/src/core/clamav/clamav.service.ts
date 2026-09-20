import { Injectable } from "@nestjs/common";
import { ClamavDatabasesService } from "./clamav-databases.service";
import { ClamavPublishedService } from "./clamav-published.service";
import { ClamdClient } from "./clamd.client";
import type { ClamavStatus } from "./clamav.types";

// The one place the scanner is read. Three sources, each answering for what only
// it knows: clamd for the engine it runs and what it is doing, the files on disk
// for the databases it was given, and ClamAV's own record for what the current
// versions are. None of them can fail the page: a scanner that is down still has
// databases to show, and databases with no published version to compare to are
// still databases with a date.
@Injectable()
export class ClamavService {
  constructor(
    private readonly clamd: ClamdClient,
    private readonly files: ClamavDatabasesService,
    private readonly publishedVersions: ClamavPublishedService
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
