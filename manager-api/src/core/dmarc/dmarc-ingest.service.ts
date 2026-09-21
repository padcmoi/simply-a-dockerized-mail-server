import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { readFile, readdir, rename, stat, unlink } from "fs/promises";
import { basename, dirname, join } from "path";
import { Repository } from "typeorm";
import { DmarcEvaluation } from "../entities/dmarc-evaluation.entity";
import { parseHistory } from "./dmarc-history.parser";
import type { DmarcEvaluationInput } from "./dmarc.types";

export const DMARC_SETTLE_MS = 2_000;
const CHUNK = 500;

export function historyPath() {
  return process.env.DMARC_HISTORY_PATH ?? "/var/lib/opendmarc/opendmarc.dat";
}

export function toEvaluationRow(evaluation: DmarcEvaluationInput): Partial<DmarcEvaluation> {
  return {
    receivedAt: evaluation.receivedAt,
    jobId: evaluation.jobId.slice(0, 64),
    reporter: evaluation.reporter.slice(0, 255),
    sourceIp: evaluation.sourceIp.slice(0, 45),
    headerFrom: evaluation.headerFrom.slice(0, 255),
    envelopeFrom: evaluation.envelopeFrom?.slice(0, 255) ?? null,
    policyDomain: evaluation.policyDomain.slice(0, 255),
    spfResult: evaluation.spfResult,
    dkim: evaluation.dkim,
    dkimAligned: evaluation.dkimAligned,
    spfAligned: evaluation.spfAligned,
    disposition: evaluation.disposition,
    policy: evaluation.policy,
    subdomainPolicy: evaluation.subdomainPolicy,
    adkim: evaluation.adkim,
    aspf: evaluation.aspf,
    pct: evaluation.pct,
    rua: evaluation.rua,
  };
}

@Injectable()
export class DmarcIngestService {
  private readonly log = new Logger(DmarcIngestService.name);
  private running = false;
  lastRunAt: number | null = null;
  lastCount = 0;

  constructor(
    @InjectRepository(DmarcEvaluation)
    private readonly evaluations: Repository<DmarcEvaluation>
  ) {}

  protected wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async claim(path: string): Promise<string[]> {
    const dir = dirname(path);
    const prefix = `${basename(path)}.ingest-`;
    const claimed = (await readdir(dir).catch(() => [] as string[]))
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name) => join(dir, name));

    const size = await stat(path)
      .then((s) => s.size)
      .catch(() => 0);
    if (size > 0) {
      const target = `${path}.ingest-${Date.now()}`;
      await rename(path, target);
      await this.wait(DMARC_SETTLE_MS);
      claimed.push(target);
    }
    return claimed;
  }

  async ingest(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let total = 0;
    try {
      for (const file of await this.claim(historyPath())) {
        const rows = parseHistory(await readFile(file, "utf8")).map(toEvaluationRow);
        for (let i = 0; i < rows.length; i += CHUNK) await this.evaluations.insert(rows.slice(i, i + CHUNK));
        await unlink(file);
        total += rows.length;
      }
      this.lastRunAt = Date.now();
      this.lastCount = total;
      return total;
    } catch (e) {
      this.log.warn(`reading the DMARC history failed: ${(e as Error).message}`);
      return total;
    } finally {
      this.running = false;
    }
  }
}
