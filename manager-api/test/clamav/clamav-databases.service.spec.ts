import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ConfigService } from "@nestjs/config";
import { ClamavDatabasesService } from "../../src/core/clamav/clamav-databases.service";

const directory = mkdtempSync(join(tmpdir(), "clamav-db-"));
const service = new ClamavDatabasesService(new ConfigService({ CLAMAV_DATABASE: directory }));
const missing = new ClamavDatabasesService(new ConfigService({ CLAMAV_DATABASE: join(directory, "nowhere") }));

/** ClamAV's own header, 512 bytes of ASCII padded with spaces, then the data. */
function database(name: string, header: string, body = "x".repeat(64)) {
  writeFileSync(join(directory, name), header.padEnd(512, " ") + body);
}

beforeAll(() => {
  database("main.cvd", "ClamAV-VDB:16 Dec 2025 23-18 +0000:63:3287027:90:9c353a6b:gI9w3c");
  // Both suffixes present: freshclam leaves the .cld after patching the .cvd it
  // downloaded, and the .cld is the one it keeps up to date.
  database("daily.cvd", "ClamAV-VDB:01 Jan 2026 00-00 +0000:28000:300000:90:X:X");
  database("daily.cld", "ClamAV-VDB:20 Sep 2026 06-26 +0000:28129:355666:90:X:X");
  database("bytecode.cvd", "ClamAV-VDB:11 Sep 2025 08-29 +0000:339:80:90:8bdb03f6:ow+EI2");
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("ClamavDatabasesService", () => {
  it("reads the version, the build moment and the signature count out of each header", () => {
    const [main, daily, bytecode] = service.read();

    expect(main).toEqual({
      name: "main",
      file: "main.cvd",
      version: 63,
      builtAt: Date.parse("16 Dec 2025 23:18 +0000"),
      signatures: 3287027,
      bytes: 576,
      published: null,
      behind: null,
    });
    expect(daily).toMatchObject({ name: "daily", version: 28129, signatures: 355666 });
    expect(bytecode).toMatchObject({ name: "bytecode", file: "bytecode.cvd", version: 339, signatures: 80 });
  });

  // The order is the one the page reads them in, not the order of the directory.
  it("answers main, daily and bytecode in that order", () => {
    expect(service.read().map((database) => database.name)).toEqual(["main", "daily", "bytecode"]);
  });

  it("prefers the patched .cld over the .cvd it was made from", () => {
    const daily = service.read().find((database) => database.name === "daily");
    expect(daily?.file).toBe("daily.cld");
    expect(daily?.builtAt).toBe(Date.parse("20 Sep 2026 06:26 +0000"));
  });

  it("leaves out a database that is not there at all", () => {
    const empty = new ClamavDatabasesService(new ConfigService({ CLAMAV_DATABASE: mkdtempSync(join(tmpdir(), "clamav-none-")) }));
    expect(empty.read()).toEqual([]);
  });

  it("answers nothing rather than throwing when the directory is missing", () => {
    expect(missing.read()).toEqual([]);
  });

  // A file that is there and says nothing is a file with no version, not a
  // service that fails: the page still has its name, its size and its date.
  it("keeps a file whose header is not ClamAV's, with nothing read out of it", () => {
    const odd = mkdtempSync(join(tmpdir(), "clamav-odd-"));
    writeFileSync(join(odd, "daily.cld"), "not a database at all");
    const reader = new ClamavDatabasesService(new ConfigService({ CLAMAV_DATABASE: odd }));

    expect(reader.read()).toEqual([
      {
        name: "daily",
        file: "daily.cld",
        version: null,
        builtAt: null,
        signatures: null,
        bytes: 21,
        published: null,
        behind: null,
      },
    ]);
    rmSync(odd, { recursive: true, force: true });
  });

  it("falls back to the default directory when nothing names one", () => {
    expect(new ClamavDatabasesService(new ConfigService({})).read()).toEqual([]);
  });
});
