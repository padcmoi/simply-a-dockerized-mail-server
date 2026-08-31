import { Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Written by service.sh from `git describe --tags --abbrev=0` and baked into the
// image at build time, so the running API names the tag it was built from
// without needing git, the repository, or anything in its environment.
const VERSION_FILE = join(__dirname, "..", "..", "..", "VERSION");

@Injectable()
export class InfoService {
  private readonly version = this.readVersion();

  codeVersion(): string {
    return this.version;
  }

  private readVersion(): string {
    try {
      return readFileSync(VERSION_FILE, "utf8").trim() || "unknown";
    } catch {
      return "unknown";
    }
  }
}
