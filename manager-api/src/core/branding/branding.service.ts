import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createHash } from "crypto";
import { constants, createReadStream } from "fs";
import { chmod, copyFile, lstat, readFile, stat } from "fs/promises";
import { join } from "path";
import type { Readable } from "stream";

export const BRANDING_PATH = "/host/volumes";
export const BRANDING_DEFAULTS_PATH = "/host/project/manager-ui/app/assets";
export const BRANDING_FILES = {
  icon: "custom-mail-icon.svg",
  logo: "custom-mail-logo.svg",
  favicon: "custom-mail-favicon.svg",
} as const;
export const BRANDING_DEFAULTS = {
  icon: "favicon.svg",
  logo: "naskot-mail-logo.svg",
  favicon: "favicon.svg",
} as const;
export const BRANDING_MAX_BYTES = 512 * 1024;
export const BRANDING_FILE_MODE = 0o777;

export type BrandingKind = keyof typeof BRANDING_FILES;

export interface BrandingView {
  custom: boolean;
  version: string | null;
  favicon: string | null;
}

interface BrandingFile {
  path: string;
  size: number;
  mtimeMs: number;
  untouched: boolean;
}

// A company puts its own marks at the root of the volumes folder, next to the
// data of the server, so they are kept and backed up with it. The files are
// looked up on every call: replaced or removed, they are seen at once with no
// restart.
//
// When the API starts, a name that is missing there gets a copy of the mark
// the interface ships with, as a file to replace; one that is there is never
// touched. The copy is open to everyone (777): the folder belongs to root, and
// whoever administers the server replaces the content of the file without
// having to be root. A copy nobody replaced is not a custom mark: the interface keeps
// serving its own, with everything that goes with it (the favicon in every
// format), and a server nobody personalised behaves exactly as before.
//
// The icon and the logo go together: both have to be there, and one at least
// replaced, or the interface keeps the two it ships with, one of each brand
// side by side being never what anyone wants. The favicon stands on its own:
// replaced, it is the icon of the browser tab, whatever the two others are.
@Injectable()
export class BrandingService implements OnModuleInit {
  private readonly log = new Logger(BrandingService.name);

  protected readonly dir: string = BRANDING_PATH;
  protected readonly defaultsDir: string = BRANDING_DEFAULTS_PATH;

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    for (const kind of Object.keys(BRANDING_FILES) as BrandingKind[]) {
      const target = join(this.dir, BRANDING_FILES[kind]);
      try {
        await copyFile(join(this.defaultsDir, BRANDING_DEFAULTS[kind]), target, constants.COPYFILE_EXCL);
        await chmod(target, BRANDING_FILE_MODE);
        this.log.log(`${BRANDING_FILES[kind]} put in the volumes folder, a copy of ${BRANDING_DEFAULTS[kind]} to replace`);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") continue;
        this.log.warn(`${BRANDING_FILES[kind]} could not be put in the volumes folder: ${(err as Error).message}`);
      }
    }
  }

  async state(): Promise<BrandingView> {
    const { pair, favicon } = await this.marks();
    return {
      custom: pair !== null,
      version: pair ? this.versionOf([pair.icon, pair.logo]) : null,
      favicon: favicon ? this.versionOf([favicon]) : null,
    };
  }

  async open(kind: BrandingKind): Promise<{ size: number; stream: Readable } | null> {
    const { pair, favicon } = await this.marks();
    const file = kind === "favicon" ? favicon : (pair?.[kind] ?? null);
    if (!file) return null;
    return { size: file.size, stream: createReadStream(file.path) };
  }

  private async marks() {
    const [icon, logo, favicon] = await Promise.all([this.inspect("icon"), this.inspect("logo"), this.inspect("favicon")]);
    return {
      pair: icon && logo && !(icon.untouched && logo.untouched) ? { icon, logo } : null,
      favicon: favicon && !favicon.untouched ? favicon : null,
    };
  }

  private versionOf(files: BrandingFile[]) {
    const mark = files.map((file) => `${file.size}:${file.mtimeMs}`).join("|");
    return createHash("sha256").update(mark).digest("hex").slice(0, 12);
  }

  private async inspect(kind: BrandingKind): Promise<BrandingFile | null> {
    const path = join(this.dir, BRANDING_FILES[kind]);
    const info = await lstat(path).catch(() => null);
    if (!info?.isFile() || info.size === 0 || info.size > BRANDING_MAX_BYTES) return null;
    return { path, size: info.size, mtimeMs: info.mtimeMs, untouched: await this.sameAsDefault(kind, path, info.size) };
  }

  private async sameAsDefault(kind: BrandingKind, path: string, size: number) {
    const original = join(this.defaultsDir, BRANDING_DEFAULTS[kind]);
    const info = await stat(original).catch(() => null);
    if (!info?.isFile() || info.size !== size) return false;
    const [mine, shipped] = await Promise.all([readFile(path).catch(() => null), readFile(original).catch(() => null)]);
    return mine !== null && shipped !== null && mine.equals(shipped);
  }
}
