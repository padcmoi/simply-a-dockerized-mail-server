import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { DmarcEvaluation } from "../../src/core/entities/dmarc-evaluation.entity";
import { DMARC_SETTLE_MS, DmarcIngestService, historyPath, toEvaluationRow } from "../../src/core/dmarc/dmarc-ingest.service";
import { parseHistory } from "../../src/core/dmarc/dmarc-history.parser";
import { repoMock } from "../helpers/mocks";

function record(job: string) {
  return `job ${job}\nreceived 1789900000\nipaddr 192.0.2.1\nfrom example.com\nrua mailto:d@example.com\n`;
}

class TestIngest extends DmarcIngestService {
  waited: number[] = [];
  protected override wait(ms: number) {
    this.waited.push(ms);
    return Promise.resolve();
  }
}

describe("DmarcIngestService", () => {
  let dir: string;
  let file: string;
  let repo: ReturnType<typeof repoMock<DmarcEvaluation>>;
  let svc: TestIngest;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "dmarc-ingest-"));
    file = join(dir, "opendmarc.dat");
    vi.stubEnv("DMARC_HISTORY_PATH", file);
    repo = repoMock<DmarcEvaluation>();
    repo.insert.mockResolvedValue(undefined);
    svc = new TestIngest(repo);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("claims the history file, lets the milter finish its write, stores the records and removes the claimed file", async () => {
    await writeFile(file, record("1") + record("2"));
    await expect(svc.ingest()).resolves.toBe(2);

    expect(svc.waited).toEqual([DMARC_SETTLE_MS]);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect((repo.insert.mock.calls[0]?.[0] as unknown[]).length).toBe(2);
    expect(await readdir(dir)).toEqual([]);
    expect(svc.lastCount).toBe(2);
    expect(svc.lastRunAt).not.toBeNull();
  });

  it("picks up a file claimed by a run that never finished, oldest first, before the live one", async () => {
    await writeFile(`${file}.ingest-2`, record("b"));
    await writeFile(`${file}.ingest-1`, record("a"));
    await writeFile(file, record("c"));
    await svc.ingest();
    const jobs = repo.insert.mock.calls.map((call) => (call[0] as { jobId: string }[])[0]?.jobId);
    expect(jobs).toEqual(["a", "b", "c"]);
  });

  it("leaves an empty history alone and waits for nothing", async () => {
    await writeFile(file, "");
    await expect(svc.ingest()).resolves.toBe(0);
    expect(svc.waited).toEqual([]);
    expect(await readdir(dir)).toEqual(["opendmarc.dat"]);
  });

  it("stores in chunks", async () => {
    await writeFile(file, Array.from({ length: 1201 }, (_, i) => record(String(i))).join(""));
    await expect(svc.ingest()).resolves.toBe(1201);
    expect(repo.insert.mock.calls.map((call) => (call[0] as unknown[]).length)).toEqual([500, 500, 201]);
  });

  it("keeps the claimed file when the database refuses it, to try again next time", async () => {
    await writeFile(file, record("1"));
    repo.insert.mockRejectedValue(new Error("db down"));
    await expect(svc.ingest()).resolves.toBe(0);
    expect((await readdir(dir)).some((name) => name.startsWith("opendmarc.dat.ingest-"))).toBe(true);
  });

  it("runs one pass at a time", async () => {
    await writeFile(file, record("1"));
    const first = svc.ingest();
    await expect(svc.ingest()).resolves.toBe(0);
    await first;
  });

  it("answers the milter's default path when none is configured", () => {
    vi.unstubAllEnvs();
    expect(historyPath()).toBe("/var/lib/opendmarc/opendmarc.dat");
  });

  it("cuts what does not fit the columns", () => {
    const [evaluation] = parseHistory(record("x".repeat(80)));
    expect(toEvaluationRow({ ...evaluation!, envelopeFrom: "e".repeat(300) })).toMatchObject({
      jobId: "x".repeat(64),
      envelopeFrom: "e".repeat(255),
    });
  });
});
