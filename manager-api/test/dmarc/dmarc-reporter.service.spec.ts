import { describe, it, expect, beforeEach, vi, type MockInstance } from "vitest";
import { promises as dns } from "dns";
import { gunzipSync, strFromU8 } from "fflate";
import type { DmarcEvaluation } from "../../src/core/entities/dmarc-evaluation.entity";
import type { DmarcOutgoingReport } from "../../src/core/entities/dmarc-outgoing-report.entity";
import type { DmarcMailerService } from "../../src/core/dmarc/dmarc-mailer.service";
import type { DmarcPslService } from "../../src/core/dmarc/dmarc-psl.service";
import type { DmarcSettingsService } from "../../src/core/dmarc/dmarc-settings.service";
import { DmarcReporterService, dayWindow, previousDay, toEvaluationInput } from "../../src/core/dmarc/dmarc-reporter.service";
import type { DmarcSettingsView } from "../../src/core/dmarc/dmarc.types";
import { entity, providerMock, repoMock } from "../helpers/mocks";

const DAY = dayWindow("2026-09-20");

const SETTINGS: DmarcSettingsView = {
  sendingEnabled: true,
  reportHour: 2,
  inboxes: [],
  retentionDays: 30,
  copyTo: null,
};

function evaluation(overrides: Partial<DmarcEvaluation> = {}): DmarcEvaluation {
  return entity<DmarcEvaluation>({
    jobId: "1",
    reporter: "mail.example.org",
    receivedAt: DAY.begin * 1000 + 1000,
    sourceIp: "203.0.113.5",
    headerFrom: "partner.example",
    envelopeFrom: "partner.example",
    policyDomain: "partner.example",
    spfResult: "pass",
    dkim: [],
    dkimAligned: "pass",
    spfAligned: "pass",
    disposition: "none",
    policy: "none",
    subdomainPolicy: null,
    adkim: "r",
    aspf: "r",
    pct: 100,
    rua: ["mailto:dmarc@partner.example"],
    recipientDomain: "example.org",
    ...overrides,
  });
}

describe("DmarcReporterService", () => {
  let evaluations: ReturnType<typeof repoMock<DmarcEvaluation>>;
  let outgoing: ReturnType<typeof repoMock<DmarcOutgoingReport>>;
  let send: ReturnType<typeof vi.fn>;
  let organizationalDomain: ReturnType<typeof vi.fn>;
  let resolveTxt: MockInstance<typeof dns.resolveTxt>;
  let svc: DmarcReporterService;

  beforeEach(() => {
    vi.restoreAllMocks();
    evaluations = repoMock<DmarcEvaluation>();
    outgoing = repoMock<DmarcOutgoingReport>();
    outgoing.findOne.mockResolvedValue(null);
    outgoing.save.mockImplementation(async (row: DmarcOutgoingReport) => row);
    outgoing.delete.mockResolvedValue(undefined);
    evaluations.delete.mockResolvedValue(undefined);
    send = vi.fn().mockResolvedValue(undefined);
    organizationalDomain = vi.fn(async (domain: string) => domain.split(".").slice(-2).join("."));
    resolveTxt = vi.spyOn(dns, "resolveTxt").mockRejectedValue(Object.assign(new Error("nx"), { code: "ENOTFOUND" }));
    svc = new DmarcReporterService(
      evaluations,
      outgoing,
      providerMock<DmarcSettingsService>({ get: vi.fn().mockResolvedValue(SETTINGS) }),
      providerMock<DmarcMailerService>({ send }),
      providerMock<DmarcPslService>({ organizationalDomain })
    );
  });

  it("sends, from each hosted domain, one gzipped report per evaluated domain and recipient, and records it as sent", async () => {
    evaluations.find.mockResolvedValue([
      evaluation(),
      evaluation({ jobId: "2" }),
      evaluation({ policyDomain: "quiet.example", rua: [] }),
    ]);
    const summary = await svc.run(DAY);

    expect(summary).toEqual({ day: "2026-09-20", domains: 1, sent: 1, failed: 0, skipped: 0, unchanged: 0 });
    const mail = send.mock.calls[0]?.[0];
    expect(mail).toMatchObject({
      from: "dmarc_reports@example.org",
      fromName: "example.org",
      to: "dmarc@partner.example",
      subject: `Report Domain: partner.example Submitter: example.org Report-ID: <partner.example:example.org:${DAY.begin}>`,
      filename: `example.org!partner.example!${DAY.begin}!${DAY.end}.xml.gz`,
    });
    const xml = strFromU8(gunzipSync(mail.content));
    expect(xml).toContain("<count>2</count>");
    expect(xml).toContain("<org_name>example.org</org_name>");
    expect(xml).toContain("<email>dmarc_reports@example.org</email>");
    expect(xml).toContain("<envelope_to>example.org</envelope_to>");
    const saved = outgoing.save.mock.calls[0]?.[0] as DmarcOutgoingReport;
    expect(saved).toMatchObject({
      status: "sent",
      reason: null,
      attempts: 1,
      records: 1,
      messages: 2,
      recipient: "dmarc@partner.example",
      reporterDomain: "example.org",
      policyDomain: "partner.example",
    });
    expect(saved.sentAt).toBeInstanceOf(Date);
    expect(svc.lastSummary).toEqual(summary);
  });

  it("sends each hosted domain its own report, and the unmatched mail under the server's domain", async () => {
    vi.stubEnv("MAIL_HOSTNAME", "mail.server.test");
    evaluations.find.mockResolvedValue([
      evaluation(),
      evaluation({ jobId: "2", recipientDomain: "example.net" }),
      evaluation({ jobId: "3", recipientDomain: null }),
    ]);
    await expect(svc.run(DAY)).resolves.toMatchObject({ domains: 3, sent: 3 });
    expect(send.mock.calls.map((call) => call[0].from)).toEqual([
      "dmarc_reports@example.org",
      "dmarc_reports@example.net",
      "dmarc_reports@server.test",
    ]);
    expect(outgoing.save.mock.calls.map((call) => (call[0] as DmarcOutgoingReport).reportId)).toEqual([
      `partner.example:example.org:${DAY.begin}`,
      `partner.example:example.net:${DAY.begin}`,
      `partner.example:server.test:${DAY.begin}`,
    ]);
    vi.unstubAllEnvs();
  });

  it("does not send a report a recipient already received", async () => {
    evaluations.find.mockResolvedValue([evaluation()]);
    outgoing.findOne.mockResolvedValue(entity<DmarcOutgoingReport>({ status: "sent" }));
    await expect(svc.run(DAY)).resolves.toMatchObject({ unchanged: 1, sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("tries again, on the same row, a report that failed before", async () => {
    evaluations.find.mockResolvedValue([evaluation()]);
    const previous = entity<DmarcOutgoingReport>({
      id: 9,
      status: "failed",
      attempts: 1,
      reportId: `partner.example:example.org:${DAY.begin}`,
    });
    outgoing.findOne.mockResolvedValue(previous);
    await svc.run(DAY);
    expect(outgoing.save).toHaveBeenCalledWith(expect.objectContaining({ id: 9, status: "sent", attempts: 2 }));
  });

  it("skips a recipient whose size limit the report exceeds", async () => {
    evaluations.find.mockResolvedValue([evaluation({ rua: ["mailto:dmarc@partner.example!10"] })]);
    await expect(svc.run(DAY)).resolves.toMatchObject({ skipped: 1 });
    expect(outgoing.save).toHaveBeenCalledWith(expect.objectContaining({ status: "skipped", reason: "too-large", attempts: 0 }));
    expect(send).not.toHaveBeenCalled();
  });

  it("skips a recipient in another domain that does not authorize the reports", async () => {
    evaluations.find.mockResolvedValue([evaluation({ rua: ["mailto:reports@collector.test"] })]);
    await expect(svc.run(DAY)).resolves.toMatchObject({ skipped: 1 });
    expect(resolveTxt).toHaveBeenCalledWith("partner.example._report._dmarc.collector.test");
    expect(outgoing.save).toHaveBeenCalledWith(expect.objectContaining({ reason: "not-authorized" }));
  });

  it("sends to another domain that publishes the authorization record", async () => {
    resolveTxt.mockResolvedValue([["v=DMARC1;"]]);
    evaluations.find.mockResolvedValue([evaluation({ rua: ["mailto:reports@collector.test"] })]);
    await expect(svc.run(DAY)).resolves.toMatchObject({ sent: 1 });
  });

  it("refuses an authorization record that is not a DMARC one", async () => {
    resolveTxt.mockResolvedValue([["v=spf1 -all"]]);
    await expect(svc.authorized("partner.example", "reports@collector.test")).resolves.toBe(false);
  });

  it("records the relay's refusal as a failure", async () => {
    send.mockRejectedValue(new Error("451 try later"));
    evaluations.find.mockResolvedValue([evaluation()]);
    await expect(svc.run(DAY)).resolves.toMatchObject({ failed: 1 });
    expect(outgoing.save).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", reason: "451 try later" }));
  });

  it("asks for the messages of that day only", async () => {
    evaluations.find.mockResolvedValue([]);
    await svc.run(DAY);
    const where = (evaluations.find.mock.calls[0]?.[0] as { where: { receivedAt: { value: number[] } } }).where;
    expect(where.receivedAt.value).toEqual([DAY.begin * 1000, (DAY.end + 1) * 1000 - 1]);
  });

  it("runs one pass at a time", async () => {
    let release!: (value: DmarcEvaluation[]) => void;
    evaluations.find.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const first = svc.run(DAY);
    await expect(svc.run(DAY)).resolves.toMatchObject({ domains: 0 });
    release([]);
    await first;
  });

  describe("retry", () => {
    it("answers a sent report, or one too large, as it is", async () => {
      const sent = entity<DmarcOutgoingReport>({ status: "sent" });
      await expect(svc.retry(sent)).resolves.toBe(sent);
      const large = entity<DmarcOutgoingReport>({ status: "skipped", reason: "too-large" });
      await expect(svc.retry(large)).resolves.toBe(large);
      expect(send).not.toHaveBeenCalled();
    });

    it("sends a failed report again from its stored XML", async () => {
      const row = entity<DmarcOutgoingReport>({
        status: "failed",
        reason: "timeout",
        attempts: 1,
        recipient: "dmarc@partner.example",
        reporterDomain: "example.org",
        policyDomain: "partner.example",
        reportId: "partner.example:example.org:1",
        periodBegin: 1,
        periodEnd: 2,
        xml: "<feedback/>",
      });
      await expect(svc.retry(row)).resolves.toMatchObject({ status: "sent", attempts: 2, reason: null });
      expect(send.mock.calls[0]?.[0]).toMatchObject({ from: "dmarc_reports@example.org", fromName: "example.org" });
    });
  });

  it("prunes what is older than the retention", async () => {
    await svc.prune(40 * 86_400_000);
    const cutoff = 10 * 86_400_000;
    expect((evaluations.delete.mock.calls[0]?.[0] as { receivedAt: { value: number } }).receivedAt.value).toBe(cutoff);
    expect((outgoing.delete.mock.calls[0]?.[0] as { createdAt: { value: Date } }).createdAt.value).toEqual(new Date(cutoff));
  });

  it("keeps going when pruning fails", async () => {
    evaluations.delete.mockRejectedValue(new Error("db"));
    await expect(svc.prune(Date.now())).resolves.toBeUndefined();
  });
});

describe("the day windows", () => {
  it("covers a whole UTC day, second by second", () => {
    expect(dayWindow("2026-09-20")).toEqual({ day: "2026-09-20", begin: 1789862400, end: 1789948799 });
  });

  it("finds yesterday, whatever the hour", () => {
    expect(previousDay(Date.parse("2026-09-21T00:00:01Z")).day).toBe("2026-09-20");
    expect(previousDay(Date.parse("2026-09-21T23:59:59Z")).day).toBe("2026-09-20");
  });

  it("turns a stored row back into an evaluation, empty lists for missing ones", () => {
    const input = toEvaluationInput(evaluation({ dkim: undefined, rua: undefined }));
    expect(input.dkim).toEqual([]);
    expect(input.rua).toEqual([]);
  });
});
