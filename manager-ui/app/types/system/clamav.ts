export interface ClamavDatabase {
  /** `main`, `daily` or `bytecode`. */
  name: string;
  /** The file it was read from, `.cvd` or the unpacked `.cld`. */
  file: string;
  version: number | null;
  /** When ClamAV built it, epoch milliseconds. */
  builtAt: number | null;
  signatures: number | null;
  bytes: number | null;
  /** The version ClamAV publishes right now, null while the lookup fails. */
  published: number | null;
  /** How many versions behind it is, null when there is nothing to compare to. */
  behind: number | null;
}

export interface ClamavEngine {
  version: string | null;
  published: string | null;
  outdated: boolean;
}

export interface ClamavStats {
  threadsLive: number | null;
  threadsIdle: number | null;
  threadsMax: number | null;
  queue: number | null;
  poolsUsed: number | null;
}

export interface ClamavStatus {
  /** clamd answered its ping. */
  available: boolean;
  engine: ClamavEngine;
  /** The newest build date of the databases, epoch milliseconds. */
  signaturesAt: number | null;
  databases: ClamavDatabase[];
  stats: ClamavStats | null;
}
