import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

let directory: string;
let service: import("../../src/api/mail-logs/mail-logs.service").MailLogsService;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "mail-logs-"));
  process.env.MAIL_LOG_PATH = directory;
  const { MailLogsService } = await import("../../src/api/mail-logs/mail-logs.service");
  service = new MailLogsService();
  await writeFile(join(directory, "postfix.log"), ["one smtpd", "two qmgr", "three SMTPD", "four cleanup", ""].join("\n"));
  const big = Array.from({ length: 30000 }, (_, index) => `line ${index} ${"x".repeat(40)}`).join("\n");
  await writeFile(join(directory, "dovecot.log"), big);
});
afterAll(async () => {
  delete process.env.MAIL_LOG_PATH;
  await rm(directory, { recursive: true, force: true });
});

describe("MailLogsService", () => {
  it("returns the last lines, oldest first", async () => {
    const window = await service.tail("postfix", { lines: 2 });
    expect(window.lines).toEqual(["three SMTPD", "four cleanup"]);
    expect(window.service).toBe("postfix");
    expect(window.updatedAt).not.toBeNull();
    expect(window.truncated).toBe(false);
  });

  it("returns the whole file when it holds fewer lines than asked", async () => {
    const window = await service.tail("postfix", { lines: 50 });
    expect(window.lines).toEqual(["one smtpd", "two qmgr", "three SMTPD", "four cleanup"]);
  });

  it("keeps the lines containing the search, ignoring case", async () => {
    const window = await service.tail("postfix", { lines: 50, q: "smtpd" });
    expect(window.lines).toEqual(["one smtpd", "three SMTPD"]);
  });

  it("reads across chunks without breaking a line", async () => {
    const window = await service.tail("dovecot", { lines: 3000 });
    expect(window.lines).toHaveLength(3000);
    expect(window.lines.at(-1)).toMatch(/^line 29999 x+$/);
    expect(window.lines[0]).toMatch(/^line 27000 x+$/);
    expect(window.lines.every((line) => /^line \d+ x{40}$/.test(line))).toBe(true);
  });

  it("finds the very first line of the file", async () => {
    const window = await service.tail("dovecot", { lines: 1, q: "line 0 " });
    expect(window.lines).toEqual([`line 0 ${"x".repeat(40)}`]);
  });

  it("pages back through the whole file with the start of each window", async () => {
    const pages: string[][] = [];
    let before: number | undefined;
    for (;;) {
      const window = await service.tail("dovecot", { lines: 7000, ...(before === undefined ? {} : { before }) });
      pages.unshift(window.lines);
      if (window.start === 0) break;
      before = window.start;
    }
    const all = pages.flat();
    expect(pages).toHaveLength(5);
    expect(all).toHaveLength(30000);
    expect(all[0]).toMatch(/^line 0 x+$/);
    expect(all.every((line, index) => line === `line ${index} ${"x".repeat(40)}`)).toBe(true);
  });

  it("pages back through the lines matching the search", async () => {
    const first = await service.tail("dovecot", { lines: 3, q: "line 1000" });
    expect(first.lines).toEqual([10007, 10008, 10009].map((n) => `line ${n} ${"x".repeat(40)}`));
    const second = await service.tail("dovecot", { lines: 3, q: "line 1000", before: first.start });
    expect(second.lines).toEqual([10004, 10005, 10006].map((n) => `line ${n} ${"x".repeat(40)}`));
  });

  it("returns nothing before the first byte", async () => {
    const window = await service.tail("dovecot", { lines: 10, before: 0 });
    expect(window.lines).toEqual([]);
    expect(window.start).toBe(0);
  });

  it("answers an empty window for a log that does not exist yet", async () => {
    await rm(join(directory, "postfix.log"));
    expect(await service.tail("postfix", { lines: 10 })).toEqual({
      service: "postfix",
      lines: [],
      size: 0,
      start: 0,
      updatedAt: null,
      truncated: false,
    });
  });
});

describe("MailLogsService.file", () => {
  it("opens the whole log with its size", async () => {
    const { writeFile } = await import("fs/promises");
    await writeFile(join(directory, "postfix.log"), "whole one\nwhole two\n");
    const file = await service.file("postfix");
    expect(file?.size).toBe(20);
    const chunks: Buffer[] = [];
    for await (const chunk of file!.stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe("whole one\nwhole two\n");
  });

  it("answers null for a log that does not exist yet", async () => {
    await rm(join(directory, "missing"), { force: true });
    const { MailLogsService } = await import("../../src/api/mail-logs/mail-logs.service");
    process.env.MAIL_LOG_PATH = join(directory, "missing");
    const empty = new MailLogsService();
    process.env.MAIL_LOG_PATH = directory;
    expect(await empty.file("dovecot")).toBeNull();
  });
});

describe("MailLogsService.follow", () => {
  it("starts at the end of the log, then hands out only what was appended since", async () => {
    const { appendFile, writeFile } = await import("fs/promises");
    const path = join(directory, "postfix.log");
    await writeFile(path, "old one\nold two\n");

    const first = await service.follow("postfix");
    expect(first).toEqual({ service: "postfix", from: 16, to: 16, lines: [] });

    await appendFile(path, "new one\nnew two\npartial");
    const second = await service.follow("postfix");
    expect(second).toEqual({ service: "postfix", from: 16, to: 32, lines: ["new one", "new two"] });

    expect(await service.follow("postfix")).toEqual({ service: "postfix", from: 32, to: 32, lines: [] });

    await appendFile(path, " line\n");
    expect(await service.follow("postfix")).toEqual({ service: "postfix", from: 32, to: 45, lines: ["partial line"] });
  });

  it("starts over from the new end when the log was rotated", async () => {
    const { writeFile } = await import("fs/promises");
    await writeFile(join(directory, "postfix.log"), "fresh\n");
    expect(await service.follow("postfix")).toEqual({ service: "postfix", from: 6, to: 6, lines: [] });
  });

  it("keeps only the last megabyte of a burst, from its first whole line", async () => {
    const { appendFile } = await import("fs/promises");
    const path = join(directory, "postfix.log");
    await appendFile(path, Array.from({ length: 40000 }, (_, index) => `burst ${index} ${"y".repeat(30)}`).join("\n") + "\n");
    const frame = await service.follow("postfix");
    expect(frame.from).toBe(6);
    expect(frame.lines.at(-1)).toMatch(/^burst 39999 y+$/);
    expect(frame.lines.every((line) => /^burst \d+ y{30}$/.test(line))).toBe(true);
    expect(frame.lines.length).toBeLessThan(40000);
  });

  it("follows a log that does not exist yet as an empty one", async () => {
    await rm(join(directory, "dovecot.log"), { force: true });
    expect(await service.follow("dovecot")).toEqual({ service: "dovecot", from: 0, to: 0, lines: [] });
  });
});
