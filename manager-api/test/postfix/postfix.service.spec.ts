import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Stats } from "fs";
import { PostfixService } from "../../src/core/postfix/postfix.service";
import { providerMock } from "../helpers/mocks";

// The service walks the postfix spool via fs/promises; mock the module so no
// real filesystem is touched. `join` (from "path") stays real, so asserting on
// the paths handed to readdir/stat verifies the spool layout it builds. The
// doubles are declared with the narrow signatures the service actually relies
// on (readdir/readFile return values, stat's isDirectory/isFile), so the stubs
// stay type-checked without a structural cast to the real fs overloads.
const fs = vi.hoisted(() => ({
  readdir: vi.fn<(path: string) => Promise<string[]>>(),
  readFile: vi.fn<(path: string) => Promise<Buffer>>(),
  stat: vi.fn<(path: string) => Promise<Partial<Pick<Stats, "isDirectory" | "isFile">>>>(),
}));
vi.mock("fs/promises", () => fs);

const FILE = { isDirectory: () => false, isFile: () => true };
const DIR = { isDirectory: () => true, isFile: () => false };

function makeService(spoolPath?: string): PostfixService {
  return new PostfixService(providerMock<ConfigService>({ get: vi.fn(() => spoolPath) }));
}

describe("PostfixService.queueStats", () => {
  beforeEach(() => {
    fs.readdir.mockReset();
    fs.stat.mockReset();
    fs.readFile.mockReset();
  });

  it("counts files per queue dir, recurses into hash subdirs, tolerates an unreadable dir", async () => {
    fs.readdir.mockImplementation(async (p: string) => {
      switch (p) {
        case "/spool/active":
          return ["hash", "loose", "gone"];
        case "/spool/active/hash":
          return ["f1", "f2"];
        case "/spool/deferred":
          return ["d1"];
        case "/spool/hold":
          return [];
        default:
          throw new Error("ENOENT"); // /spool/incoming: unreadable, scanDir swallows it as 0
      }
    });
    fs.stat.mockImplementation(async (p: string) => {
      if (p === "/spool/active/gone") throw new Error("ENOENT"); // vanished mid-scan: skipped
      return p.endsWith("/hash") ? DIR : FILE;
    });

    const res = await makeService("/spool").queueStats();

    expect(res.total).toEqual({ active: 3, deferred: 1, hold: 0, incoming: 0 });
    expect(res.domain).toBeUndefined();
    expect(res.available).toBe(true);
    // No domain filter requested, so message bodies are never opened.
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it("counts per-domain matches by scanning message bodies, skipping unreadable files", async () => {
    fs.readdir.mockImplementation(async (p: string) => (p === "/spool/active" ? ["m1", "m2", "bad"] : []));
    fs.stat.mockResolvedValue(FILE);
    fs.readFile.mockImplementation(async (p: string) => {
      if (p === "/spool/active/m1") return Buffer.from("X-Original-To: a@example.com\n");
      if (p === "/spool/active/m2") return Buffer.from("X-Original-To: b@other.com\n");
      throw new Error("EACCES"); // bad: unreadable body, counted in total but not for the domain
    });

    const res = await makeService("/spool").queueStats("example.com");

    expect(res.total).toEqual({ active: 3, deferred: 0, hold: 0, incoming: 0 });
    expect(res.domain).toEqual({ active: 1, deferred: 0, hold: 0, incoming: 0 });
    expect(res.available).toBe(true);
  });

  it("marks the queue unavailable (warning once) when a dir cannot be walked", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    // A stat result missing isDirectory/isFile makes scanDir throw past readdir,
    // which is the only path that flips `available` to false.
    fs.readdir.mockImplementation(async (p: string) =>
      p === "/spool/active" ? ["corrupt"] : p === "/spool/deferred" ? ["corrupt2"] : []
    );
    fs.stat.mockResolvedValue({});

    const res = await makeService("/spool").queueStats();

    expect(res.available).toBe(false);
    expect(res.total).toEqual({ active: 0, deferred: 0, hold: 0, incoming: 0 });
    // Two dirs fail, but the warning is emitted only on the first (the guard).
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("falls back to the default spool path when the config has none", async () => {
    fs.readdir.mockResolvedValue([]);
    await makeService(undefined).queueStats();
    expect(fs.readdir).toHaveBeenCalledWith("/var/spool/postfix/active");
    expect(fs.readdir).toHaveBeenCalledWith("/var/spool/postfix/incoming");
  });
});
