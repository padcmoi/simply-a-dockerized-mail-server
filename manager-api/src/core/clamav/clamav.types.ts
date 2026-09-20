/** A signature database as it sits on disk, against the one ClamAV publishes. */
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
  /** What clamd answers, null while it is out of reach. */
  version: string | null;
  /** What ClamAV publishes, null while the lookup fails. */
  published: string | null;
  outdated: boolean;
}

/** What clamd says about itself: the threads it has, the queue and the pools. */
export interface ClamavStats {
  threadsLive: number | null;
  threadsIdle: number | null;
  threadsMax: number | null;
  queue: number | null;
  /** Bytes the signature pools hold, which is what clamd spends its memory on. */
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

/** What the supervision loop carries on every sample of the machine. */
export interface ClamavSample {
  /** clamd answered its ping when it was last asked, a minute ago at most. */
  available: boolean;
  /** When the newest signature database was built, epoch milliseconds. */
  signaturesAt: number | null;
}
