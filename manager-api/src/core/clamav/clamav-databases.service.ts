import { openSync, readSync, closeSync, existsSync, statSync } from "fs";
import { join } from "path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ClamavDatabase } from "./clamav.types";

/** The three ClamAV ships, in the order the page reads them. */
const DATABASES = ["main", "daily", "bytecode"] as const;

/** `.cvd` is what freshclam downloads whole, `.cld` what it leaves after a patch. */
const SUFFIXES = [".cld", ".cvd"] as const;

/** Every database carries a 512 byte ASCII header, and nothing else is read. */
const HEADER_BYTES = 512;

// What is on disk, read from the files themselves rather than asked of clamd:
// clamd only ever names the daily one, and a database that has not been loaded
// yet, or a scanner that is down, would leave the page with nothing to say.
// The directory is the one freshclam writes, mounted read-only.
@Injectable()
export class ClamavDatabasesService {
  private readonly log = new Logger(ClamavDatabasesService.name);
  private readonly directory: string;

  constructor(cfg: ConfigService) {
    this.directory = cfg.get<string>("CLAMAV_DATABASE") ?? "/var/lib/clamav";
  }

  read(): ClamavDatabase[] {
    return DATABASES.map((name) => this.one(name)).filter((database) => database !== null);
  }

  private one(name: string): ClamavDatabase | null {
    const file = SUFFIXES.map((suffix) => `${name}${suffix}`).find((candidate) => existsSync(join(this.directory, candidate)));
    if (!file) return null;

    const path = join(this.directory, file);
    const header = this.header(path);
    const fields = header?.split(":") ?? [];

    return {
      name,
      file,
      version: number(fields[2]),
      builtAt: moment(fields[1]),
      signatures: number(fields[3]),
      bytes: this.size(path),
      published: null,
      behind: null,
    };
  }

  private header(path: string) {
    let handle: number | null = null;
    try {
      handle = openSync(path, "r");
      const buffer = Buffer.alloc(HEADER_BYTES);
      const read = readSync(handle, buffer, 0, HEADER_BYTES, 0);
      const text = buffer.toString("ascii", 0, read);
      return text.startsWith("ClamAV-VDB:") ? text : null;
    } catch (e) {
      this.log.warn(`reading ${path} failed: ${(e as Error).message}`);
      return null;
    } finally {
      if (handle !== null) closeSync(handle);
    }
  }

  private size(path: string) {
    try {
      return statSync(path).size;
    } catch {
      return null;
    }
  }
}

function number(field: string | undefined) {
  const value = Number(field);
  return field && Number.isFinite(value) ? value : null;
}

/** ClamAV writes "16 Dec 2025 23-18 +0000", which is a clock time with a dash. */
function moment(field: string | undefined) {
  if (!field) return null;
  const at = Date.parse(field.replace(/(\d{2})-(\d{2})/, "$1:$2"));
  return Number.isFinite(at) ? at : null;
}
