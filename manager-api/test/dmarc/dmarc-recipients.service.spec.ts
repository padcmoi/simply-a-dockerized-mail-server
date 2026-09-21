import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appendFile, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { DmarcEvaluation } from "../../src/core/entities/dmarc-evaluation.entity";
import type { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import {
  DmarcRecipientsService,
  RECIPIENT_BACKLOG_BYTES,
  RECIPIENT_SETTLE_MS,
  postfixLogPath,
  recipientOf,
} from "../../src/core/dmarc/dmarc-recipients.service";
import { entity, repoMock } from "../helpers/mocks";

const NOW = Date.parse("2026-09-21T10:00:00Z");

const delivered = (job: string, to: string, orig?: string) =>
  `Sep 21 10:00:22 mail postfix/lmtp[145]: ${job}: to=<${to}>, ${orig ? `orig_to=<${orig}>, ` : ""}relay=mail-dovecot[172.200.0.16]:24, delay=1.2, dsn=2.0.0, status=sent (250 2.0.0 Saved)\n`;
const rejected = (job: string, to: string) =>
  `Sep 21 10:00:22 mail postfix/smtpd[99]: ${job}: milter-reject: END-OF-MESSAGE from x.test[203.0.113.5]: 5.7.1 rejected by DMARC policy for partner.example; from=<a@partner.example> to=<${to}> proto=ESMTP helo=<x.test>\n`;

function evaluation(overrides: Partial<DmarcEvaluation> = {}): DmarcEvaluation {
  return entity<DmarcEvaluation>({
    id: 1,
    jobId: "54A41263BE1",
    receivedAt: NOW,
    policyDomain: "partner.example",
    recipientDomain: null,
    createdAt: new Date(NOW),
    ...overrides,
  });
}

describe("recipientOf", () => {
  it("reads the queue id and the address a delivery was meant for, the original one first", () => {
    expect(recipientOf(delivered("54A41263BE1", "Bob@Example.org"))).toEqual({
      jobId: "54A41263BE1",
      address: "bob@example.org",
    });
    expect(recipientOf(delivered("54A41263BE1", "box@elsewhere.test", "alias@example.net"))).toEqual({
      jobId: "54A41263BE1",
      address: "alias@example.net",
    });
  });

  it("reads the recipient of a message the DMARC policy rejected", () => {
    expect(recipientOf(rejected("4F0A1B2C3D", "bob@example.org"))).toEqual({ jobId: "4F0A1B2C3D", address: "bob@example.org" });
  });

  it("ignores the lines that name no recipient, or an empty one", () => {
    expect(
      recipientOf("Sep 21 10:00:22 mail postfix/qmgr[1]: 54A41263BE1: from=<a@partner.example>, size=10, nrcpt=1")
    ).toBeNull();
    expect(recipientOf("Sep 21 10:00:22 mail postfix/lmtp[1]: 54A41263BE1: to=<>, status=sent")).toBeNull();
    expect(recipientOf("garbage")).toBeNull();
  });

  it("finds the log next to the other mail logs", () => {
    vi.stubEnv("MAIL_LOG_PATH", "/logs");
    expect(postfixLogPath()).toBe("/logs/postfix.log");
    vi.unstubAllEnvs();
  });
});

describe("DmarcRecipientsService", () => {
  let dir: string;
  let log: string;
  let evaluations: ReturnType<typeof repoMock<DmarcEvaluation>>;
  let hosted: ReturnType<typeof repoMock<VirtualDomain>>;
  let svc: DmarcRecipientsService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "dmarc-recipients-"));
    log = join(dir, "postfix.log");
    vi.stubEnv("MAIL_LOG_PATH", dir);
    evaluations = repoMock<DmarcEvaluation>();
    evaluations.find.mockResolvedValue([]);
    evaluations.update.mockResolvedValue(undefined);
    evaluations.insert.mockResolvedValue(undefined);
    hosted = repoMock<VirtualDomain>();
    hosted.find.mockResolvedValue([
      entity<VirtualDomain>({ domain: "Example.org" }),
      entity<VirtualDomain>({ domain: "example.net" }),
    ]);
    svc = new DmarcRecipientsService(evaluations, hosted);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("waits for a message's deliveries to settle before naming its recipient", async () => {
    await writeFile(log, delivered("54A41263BE1", "bob@example.org"));
    await expect(svc.resolve(NOW)).resolves.toBe(0);
    expect(evaluations.find).not.toHaveBeenCalled();

    evaluations.find.mockResolvedValue([evaluation()]);
    await expect(svc.resolve(NOW + RECIPIENT_SETTLE_MS)).resolves.toBe(1);
    expect(evaluations.update).toHaveBeenCalledWith({ id: 1 }, { recipientDomain: "example.org" });
    expect(evaluations.insert).not.toHaveBeenCalled();
  });

  it("gives a message delivered to several hosted domains one evaluation per domain, and forgets the external ones", async () => {
    await writeFile(
      log,
      delivered("54A41263BE1", "bob@example.org") +
        delivered("54A41263BE1", "ann@example.net") +
        delivered("54A41263BE1", "joe@elsewhere.test") +
        rejected("99B1C2D3E4", "joe@elsewhere.test")
    );
    await svc.resolve(NOW);
    evaluations.find.mockResolvedValue([evaluation()]);
    await svc.resolve(NOW + RECIPIENT_SETTLE_MS);

    const where = (evaluations.find.mock.calls[0]?.[0] as { where: { jobId: { value: string[] } } }).where;
    expect(where.jobId.value).toEqual(["54A41263BE1"]);
    expect(evaluations.update).toHaveBeenCalledWith({ id: 1 }, { recipientDomain: "example.net" });
    expect(evaluations.insert).toHaveBeenCalledWith([
      expect.objectContaining({ jobId: "54A41263BE1", policyDomain: "partner.example", recipientDomain: "example.org" }),
    ]);
    const clone = (evaluations.insert.mock.calls[0]?.[0] as Partial<DmarcEvaluation>[])[0];
    expect(clone).not.toHaveProperty("id");
    expect(clone).not.toHaveProperty("createdAt");
  });

  it("reads only what was written since the previous pass, and a line still being written on the next one", async () => {
    await writeFile(log, delivered("54A41263BE1", "bob@example.org"));
    await svc.resolve(NOW);
    await svc.resolve(NOW + RECIPIENT_SETTLE_MS);
    evaluations.find.mockClear();

    const line = delivered("7C8D9E0F1A", "ann@example.net");
    await appendFile(log, line.slice(0, 20));
    await svc.resolve(NOW + 2 * RECIPIENT_SETTLE_MS);
    expect(evaluations.find).not.toHaveBeenCalled();

    await appendFile(log, line.slice(20));
    await svc.resolve(NOW + 3 * RECIPIENT_SETTLE_MS);
    await svc.resolve(NOW + 4 * RECIPIENT_SETTLE_MS);
    const where = (evaluations.find.mock.calls[0]?.[0] as { where: { jobId: { value: string[] } } }).where;
    expect(where.jobId.value).toEqual(["7C8D9E0F1A"]);
  });

  it("starts again from the backlog when the log was truncated", async () => {
    await writeFile(log, delivered("54A41263BE1", "bob@example.org").repeat(3));
    await svc.resolve(NOW);
    await writeFile(log, delivered("7C8D9E0F1A", "ann@example.net"));
    await svc.resolve(NOW);
    await svc.resolve(NOW + RECIPIENT_SETTLE_MS);
    const where = (evaluations.find.mock.calls[0]?.[0] as { where: { jobId: { value: string[] } } }).where;
    expect(where.jobId.value).toEqual(["54A41263BE1", "7C8D9E0F1A"]);
    expect(RECIPIENT_BACKLOG_BYTES).toBeGreaterThan(0);
  });

  it("does nothing without a log, and swallows a failing database", async () => {
    await expect(svc.resolve(NOW)).resolves.toBe(0);
    await writeFile(log, delivered("54A41263BE1", "bob@example.org"));
    hosted.find.mockRejectedValueOnce(new Error("db"));
    await expect(svc.resolve(NOW)).resolves.toBe(0);
  });

  it("runs one pass at a time", async () => {
    let release!: (value: VirtualDomain[]) => void;
    hosted.find.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const first = svc.resolve(NOW);
    await expect(svc.resolve(NOW)).resolves.toBe(0);
    release([]);
    await first;
  });
});
