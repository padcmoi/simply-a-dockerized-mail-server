import { promises as dns } from "dns";
import { Injectable, Logger } from "@nestjs/common";

/** Where ClamAV publishes what the current versions are. */
const RECORD = "current.cvd.clamav.net";

/** "1.4.6:63:28129:1789910940:1:90:49192:339": engine, main, daily, then the
 *  build moment, three figures the scanner does not need here, and bytecode. */
const FIELDS = { engine: 0, main: 1, daily: 2, bytecode: 7 } as const;

/** ClamAV asks for no more than one lookup an hour; this is well inside that. */
const CACHE_MS = 600_000;

export interface ClamavPublished {
  engine: string | null;
  versions: Record<string, number | null>;
}

const NOTHING: ClamavPublished = { engine: null, versions: {} };

// What ClamAV publishes right now, which is the only way "up to date" means
// anything: a version number on its own says nothing about whether a newer one
// exists. freshclam reads the same record, so the page and the updater are
// looking at one source.
//
// Held for ten minutes and answered from that hold: the page is read live and
// over a websocket topic, and a DNS lookup per frame would be a lookup a second
// for a record that changes a few times a day. A failed lookup answers with
// nothing rather than throwing, and the page simply has no published version to
// compare against.
@Injectable()
export class ClamavPublishedService {
  private readonly log = new Logger(ClamavPublishedService.name);

  private held: ClamavPublished = NOTHING;
  private heldAt = 0;

  async read(): Promise<ClamavPublished> {
    if (this.heldAt && Date.now() - this.heldAt < CACHE_MS) return this.held;

    try {
      const records = await dns.resolveTxt(RECORD);
      const fields = records.flat().join("").split(":");
      this.held = {
        engine: fields[FIELDS.engine] ?? null,
        versions: {
          main: number(fields[FIELDS.main]),
          daily: number(fields[FIELDS.daily]),
          bytecode: number(fields[FIELDS.bytecode]),
        },
      };
      this.heldAt = Date.now();
    } catch (e) {
      this.log.warn(`reading the published clamav versions failed: ${(e as Error).message}`);
      // Kept, rather than emptied: a lookup that fails once says nothing about
      // the versions it answered with a minute ago.
      if (!this.heldAt) this.held = NOTHING;
    }

    return this.held;
  }
}

function number(field: string | undefined) {
  const value = Number(field);
  return field && Number.isFinite(value) ? value : null;
}
