import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { DmarcEvaluation } from "../../src/core/entities/dmarc-evaluation.entity";
import type { DmarcInboxMessage } from "../../src/core/entities/dmarc-inbox-message.entity";
import type { DmarcIncomingRecord } from "../../src/core/entities/dmarc-incoming-record.entity";
import type { DmarcIncomingReport } from "../../src/core/entities/dmarc-incoming-report.entity";
import type { DmarcOutgoingReport } from "../../src/core/entities/dmarc-outgoing-report.entity";
import type { VirtualDomain } from "../../src/core/entities/virtual-domain.entity";
import type { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import type { DmarcInboxService } from "../../src/core/dmarc/dmarc-inbox.service";
import type { DmarcIngestService } from "../../src/core/dmarc/dmarc-ingest.service";
import type { DmarcRecipientsService } from "../../src/core/dmarc/dmarc-recipients.service";
import type { DmarcReporterService } from "../../src/core/dmarc/dmarc-reporter.service";
import type { DmarcSettingsService } from "../../src/core/dmarc/dmarc-settings.service";
import { DmarcService } from "../../src/core/dmarc/dmarc.service";
import { entity, providerMock, qbMock, repoMock } from "../helpers/mocks";

const SETTINGS = {
  sendingEnabled: true,
  reportHour: 2,
  inboxes: ["dmarc@example.org"],
  retentionDays: 90,
};

describe("DmarcService", () => {
  let evaluations: ReturnType<typeof repoMock<DmarcEvaluation>>;
  let incoming: ReturnType<typeof repoMock<DmarcIncomingReport>>;
  let records: ReturnType<typeof repoMock<DmarcIncomingRecord>>;
  let outgoing: ReturnType<typeof repoMock<DmarcOutgoingReport>>;
  let inboxMessages: ReturnType<typeof repoMock<DmarcInboxMessage>>;
  let users: ReturnType<typeof repoMock<VirtualUser>>;
  let hosted: ReturnType<typeof repoMock<VirtualDomain>>;
  const settings = { get: vi.fn(), update: vi.fn() };
  const ingest = { ingest: vi.fn(), lastRunAt: 5, lastCount: 3 };
  const recipients = { resolve: vi.fn() };
  const inbox = { scan: vi.fn(), mailboxes: vi.fn(), lastRunAt: 6 };
  const reporter = { run: vi.fn(), retry: vi.fn(), lastRunAt: 7, lastSummary: null };
  let svc: DmarcService;

  beforeEach(() => {
    vi.clearAllMocks();
    evaluations = repoMock<DmarcEvaluation>();
    incoming = repoMock<DmarcIncomingReport>();
    records = repoMock<DmarcIncomingRecord>();
    outgoing = repoMock<DmarcOutgoingReport>();
    inboxMessages = repoMock<DmarcInboxMessage>();
    users = repoMock<VirtualUser>();
    hosted = repoMock<VirtualDomain>();
    hosted.find.mockResolvedValue([entity<VirtualDomain>({ domain: "Example.org" })]);
    settings.get.mockResolvedValue(SETTINGS);
    inbox.mailboxes.mockResolvedValue(["dmarc_reports@example.org", "dmarc@example.org"]);
    settings.update.mockImplementation(async (value: object) => ({ ...SETTINGS, ...value }));
    svc = new DmarcService(
      evaluations,
      incoming,
      records,
      outgoing,
      inboxMessages,
      users,
      hosted,
      providerMock<DmarcSettingsService>(settings),
      providerMock<DmarcIngestService>(ingest),
      providerMock<DmarcRecipientsService>(recipients),
      providerMock<DmarcInboxService>(inbox),
      providerMock<DmarcReporterService>(reporter)
    );
  });

  it("sums the last thirty days, per status and per domain", async () => {
    evaluations.count.mockResolvedValue(12);
    const domains = qbMock<DmarcIncomingReport>();
    domains.getRawMany.mockResolvedValue([
      {
        domain: "example.org",
        reports: "3",
        reporters: "2",
        messages: "40",
        dmarcPass: "38",
        dkimPass: "37",
        spfPass: "36",
        lastPeriodEnd: "1789948799",
      },
      {
        domain: "quiet.org",
        reports: "1",
        reporters: "1",
        messages: null,
        dmarcPass: null,
        dkimPass: null,
        spfPass: null,
        lastPeriodEnd: null,
      },
    ]);
    const sent = qbMock<DmarcOutgoingReport>();
    sent.getRawMany.mockResolvedValue([
      { status: "sent", total: "4" },
      { status: "skipped", total: "1" },
    ]);
    const scanned = qbMock<DmarcInboxMessage>();
    scanned.getRawMany.mockResolvedValue([{ status: "not-a-report", total: "2" }]);
    incoming.createQueryBuilder.mockReturnValue(domains);
    outgoing.createQueryBuilder.mockReturnValue(sent);
    inboxMessages.createQueryBuilder.mockReturnValue(scanned);

    const overview = await svc.overview(100 * 86_400_000);
    expect(overview).toEqual({
      settings: { sendingEnabled: true, reportHour: 2, inboxes: ["dmarc_reports@example.org", "dmarc@example.org"] },
      hostedDomains: ["example.org"],
      ingest: { lastRunAt: 5, lastCount: 3, evaluations24h: 12 },
      outgoing: { lastRunAt: 7, lastSummary: null, sent: 4, failed: 0, skipped: 1 },
      inbox: { lastRunAt: 6, imported: 0, duplicate: 0, ignored: 2, failed: 0 },
      domains: [
        {
          domain: "example.org",
          reports: 3,
          reporters: 2,
          messages: 40,
          dmarcPass: 38,
          dkimPass: 37,
          spfPass: 36,
          lastPeriodEnd: 1789948799,
        },
        {
          domain: "quiet.org",
          reports: 1,
          reporters: 1,
          messages: 0,
          dmarcPass: 0,
          dkimPass: 0,
          spfPass: 0,
          lastPeriodEnd: null,
        },
      ],
    });
    expect(domains.where).toHaveBeenCalledWith("r.received_at >= :since", { since: new Date(70 * 86_400_000) });
  });

  it("pages the received reports, filtered, searched and sorted on known columns only", async () => {
    incoming.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);
    await expect(
      svc.listIncoming({
        domain: "example.org",
        search: "goo",
        searchBy: "orgName",
        sortBy: "messages",
        sortDir: "asc",
        offset: 10,
        limit: 10,
      })
    ).resolves.toEqual({ items: [{ id: 1 }], total: 1 });
    const options = incoming.findAndCount.mock.calls[0]?.[0] as {
      where: object[];
      order: object;
      skip: number;
      take: number;
      select: string[];
    };
    expect(options.where).toEqual([{ domain: "example.org", orgName: expect.anything() }]);
    expect(options.order).toEqual({ messages: "ASC", id: "DESC" });
    expect(options).toMatchObject({ skip: 10, take: 10 });
    expect(options.select).not.toContain("xml");

    await svc.listIncoming({ sortBy: "xml; drop", sortDir: "desc", offset: 0 });
    expect((incoming.findAndCount.mock.calls[1]?.[0] as { order: object; where: object; take: number }).order).toEqual({
      periodBegin: "DESC",
      id: "DESC",
    });
    expect((incoming.findAndCount.mock.calls[1]?.[0] as { take: number }).take).toBe(25);
  });

  it("keeps the sent reports of the hosted domain filtered on when searching, its column left out", async () => {
    outgoing.findAndCount.mockResolvedValue([[], 0]);
    await svc.listOutgoing({ search: "partner", status: "failed", domain: "example.org", sortDir: "desc", offset: 0 });
    const where = (outgoing.findAndCount.mock.calls[0]?.[0] as { where: object[] }).where;
    expect(where).toHaveLength(3);
    expect(where.map((clause) => Object.keys(clause).sort())).toEqual([
      ["policyDomain", "reporterDomain", "status"],
      ["recipient", "reporterDomain", "status"],
      ["reportId", "reporterDomain", "status"],
    ]);
    expect(where.every((clause) => (clause as { reporterDomain: string }).reporterDomain === "example.org")).toBe(true);
  });

  it("searches the sending domain as well when no domain is filtered on", async () => {
    outgoing.findAndCount.mockResolvedValue([[], 0]);
    await svc.listOutgoing({ search: "example", sortDir: "desc", offset: 0 });
    const where = (outgoing.findAndCount.mock.calls[0]?.[0] as { where: object[] }).where;
    expect(where.map((clause) => Object.keys(clause))).toEqual([
      ["reporterDomain"],
      ["policyDomain"],
      ["recipient"],
      ["reportId"],
    ]);
  });

  it("keeps the domain filter of the received reports when searching, the domain column left out", async () => {
    incoming.findAndCount.mockResolvedValue([[], 0]);
    await svc.listIncoming({ domain: "example.org", search: "goo", sortDir: "desc", offset: 0 });
    const where = (incoming.findAndCount.mock.calls[0]?.[0] as { where: Record<string, unknown>[] }).where;
    expect(where).toHaveLength(3);
    expect(where.every((clause) => clause.domain === "example.org")).toBe(true);
  });

  it("filters the read messages on the domain of their mailbox, which a search cannot widen", async () => {
    inboxMessages.findAndCount.mockResolvedValue([[], 0]);
    await svc.listInbox({ domain: "example.org", search: "google", sortDir: "desc", offset: 0 });
    const where = (inboxMessages.findAndCount.mock.calls[0]?.[0] as { where: Record<string, { value: string }>[] }).where;
    expect(where).toHaveLength(2);
    expect(where.every((clause) => clause.mailbox?.value === "%@example.org")).toBe(true);
  });

  it("pages the read messages by status", async () => {
    inboxMessages.findAndCount.mockResolvedValue([[], 0]);
    await svc.listInbox({ status: "failed", sortDir: "asc", sortBy: "mailbox", offset: 0 });
    expect(inboxMessages.findAndCount.mock.calls[0]?.[0]).toMatchObject({
      where: { status: "failed" },
      order: { mailbox: "ASC", id: "DESC" },
    });
  });

  it("answers a received report with its rows, and 404 for an unknown one", async () => {
    incoming.findOne.mockResolvedValueOnce(entity<DmarcIncomingReport>({ id: 3, orgName: "google.com" }));
    records.find.mockResolvedValue([{ id: 1 }]);
    await expect(svc.incomingReport(3)).resolves.toEqual({ id: 3, orgName: "google.com", rows: [{ id: 1 }] });
    incoming.findOne.mockResolvedValue(null);
    await expect(svc.incomingReport(4)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.incomingXml(4)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("hands out the XML with a safe file name", async () => {
    incoming.findOne.mockResolvedValue(entity<DmarcIncomingReport>({ orgName: "Mail.ru Group", reportId: "a/b", xml: "<x/>" }));
    await expect(svc.incomingXml(1)).resolves.toEqual({ filename: "Mail.ru_Group!a_b.xml", xml: "<x/>" });
    outgoing.findOne.mockResolvedValue(entity<DmarcOutgoingReport>({ reportId: "partner.example:1789862400", xml: "<y/>" }));
    await expect(svc.outgoingXml(1)).resolves.toEqual({ filename: "partner.example_1789862400.xml", xml: "<y/>" });
    outgoing.findOne.mockResolvedValue(null);
    await expect(svc.outgoingXml(2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("retries a sent report without handing its XML back, and 404 for an unknown one", async () => {
    outgoing.findOne.mockResolvedValueOnce(entity<DmarcOutgoingReport>({ id: 1, status: "failed" }));
    reporter.retry.mockResolvedValue(entity<DmarcOutgoingReport>({ id: 1, status: "sent", xml: "<z/>" }));
    await expect(svc.retryOutgoing(1)).resolves.toEqual({ id: 1, status: "sent" });
    outgoing.findOne.mockResolvedValue(null);
    await expect(svc.retryOutgoing(2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reports a day that is over, after reading the history, and refuses today", async () => {
    reporter.run.mockResolvedValue({ day: "2026-09-19" });
    const now = Date.parse("2026-09-21T10:00:00Z");
    await svc.runReports("2026-09-19", now);
    expect(ingest.ingest).toHaveBeenCalled();
    expect(recipients.resolve).toHaveBeenCalled();
    expect(reporter.run).toHaveBeenCalledWith(expect.objectContaining({ day: "2026-09-19" }));
    await svc.runReports(undefined, now);
    expect(reporter.run).toHaveBeenLastCalledWith(expect.objectContaining({ day: "2026-09-20" }));
    await expect(svc.runReports("2026-09-21", now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("scans the inboxes and reads the settings through their services", async () => {
    inbox.scan.mockResolvedValue({ scanned: 1 });
    await expect(svc.scanInbox()).resolves.toEqual({ scanned: 1 });
    await expect(svc.getSettings()).resolves.toEqual(SETTINGS);
  });

  it("saves inboxes that are mailboxes of the server, once each, and refuses the others", async () => {
    users.find.mockResolvedValue([entity<VirtualUser>({ email: "dmarc@example.org" })]);
    await expect(svc.updateSettings({ ...SETTINGS, inboxes: ["DMARC@example.org", "dmarc@example.org"] })).resolves.toMatchObject(
      {
        inboxes: ["dmarc@example.org"],
      }
    );
    await expect(svc.updateSettings({ ...SETTINGS, inboxes: ["ghost@example.org"] })).rejects.toThrow("ghost@example.org");
  });

  it("lists the mailboxes in order", async () => {
    users.find.mockResolvedValue([
      entity<VirtualUser>({ email: "a@example.org" }),
      entity<VirtualUser>({ email: "b@example.org" }),
    ]);
    await expect(svc.mailboxes()).resolves.toEqual(["a@example.org", "b@example.org"]);
    expect(users.find).toHaveBeenCalledWith({ select: { email: true }, order: { email: "ASC" } });
  });
});
