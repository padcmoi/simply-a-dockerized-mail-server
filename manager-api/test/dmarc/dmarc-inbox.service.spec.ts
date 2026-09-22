import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, mkdtemp, rm, truncate, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { strToU8, zipSync } from "fflate";
import type { DataSource, EntityManager } from "typeorm";
import type { DmarcInboxMessage } from "../../src/core/entities/dmarc-inbox-message.entity";
import type { DmarcIncomingReport } from "../../src/core/entities/dmarc-incoming-report.entity";
import type { VirtualUser } from "../../src/core/entities/virtual-user.entity";
import { DmarcInboxService, messageKey, totals } from "../../src/core/dmarc/dmarc-inbox.service";
import { parseFeedback } from "../../src/core/dmarc/dmarc-feedback.parser";
import type { DmarcImapService } from "../../src/core/dmarc/dmarc-imap.service";
import type { DmarcSettingsService } from "../../src/core/dmarc/dmarc-settings.service";
import type { DmarcSettingsView } from "../../src/core/dmarc/dmarc.types";
import { entity, providerMock, repoMock } from "../helpers/mocks";
import { GOOGLE_REPORT, mimeMessage } from "./fixtures";

const SETTINGS: DmarcSettingsView = {
  sendingEnabled: false,
  reportHour: 2,
  inboxes: [],
  retentionDays: 30,
};

describe("DmarcInboxService", () => {
  let root: string;
  let maildir: string;
  let messages: ReturnType<typeof repoMock<DmarcInboxMessage>>;
  let reports: ReturnType<typeof repoMock<DmarcIncomingReport>>;
  let users: ReturnType<typeof repoMock<VirtualUser>>;
  let manager: ReturnType<typeof providerMock<EntityManager>>;
  let imap: ReturnType<typeof providerMock<DmarcImapService>>;
  let inboxes: string[];
  let svc: DmarcInboxService;

  const zipped = () => zipSync({ "report.xml": strToU8(GOOGLE_REPORT) });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "dmarc-inbox-"));
    maildir = join(root, "vhosts", "example.com", "dmarc");
    await mkdir(join(maildir, "new"), { recursive: true });
    await mkdir(join(maildir, "cur"), { recursive: true });
    vi.stubEnv("MAIL_VOLUME_PATH", root);

    inboxes = ["dmarc@example.com"];
    messages = repoMock<DmarcInboxMessage>();
    messages.find.mockResolvedValue([]);
    messages.insert.mockResolvedValue(undefined);
    reports = repoMock<DmarcIncomingReport>();
    reports.findOne.mockResolvedValue(null);
    reports.delete.mockResolvedValue(undefined);
    users = repoMock<VirtualUser>();
    users.findOne.mockResolvedValue(entity<VirtualUser>({ email: "dmarc@example.com", maildir: "example.com/dmarc/" }));
    users.find.mockResolvedValue([]);
    manager = providerMock<EntityManager>({ create: vi.fn(), save: vi.fn(), insert: vi.fn() });
    manager.create.mockImplementation((_entity: unknown, value: object) => ({ ...value }));
    manager.save.mockImplementation(async (value: object) => ({ ...value, id: 42 }));
    manager.insert.mockResolvedValue(undefined);
    const transaction = vi.fn();
    transaction.mockImplementation(async (work: (m: EntityManager) => unknown) => work(manager));
    const dataSource = providerMock<DataSource>({ transaction });
    imap = providerMock<DmarcImapService>({ expunge: vi.fn() });
    imap.expunge.mockImplementation(async (_mailbox: string, targets: unknown[]) => targets.length);
    svc = new DmarcInboxService(
      messages,
      reports,
      users,
      providerMock<DmarcSettingsService>({ get: vi.fn(async () => ({ ...SETTINGS, inboxes })) }),
      dataSource,
      imap
    );
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("imports the report of a new message, with its rows, and records the message", async () => {
    await writeFile(
      join(maildir, "new", "1789.M1.host"),
      mimeMessage({ filename: "r.zip", type: "application/zip", content: zipped() })
    );
    await expect(svc.scan()).resolves.toEqual({
      mailboxes: 1,
      scanned: 1,
      imported: 1,
      duplicates: 0,
      ignored: 0,
      failed: 0,
      deleted: 0,
    });
    expect(imap.expunge).not.toHaveBeenCalled();

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orgName: "google.com",
        domain: "example.com",
        messages: 19,
        dmarcPass: 17,
        records: 2,
        mailbox: "dmarc@example.com",
      })
    );
    const rows = manager.insert.mock.calls[0]?.[1] as { reportId: number; count: number }[];
    expect(rows.map((row) => [row.reportId, row.count])).toEqual([
      [42, 17],
      [42, 2],
    ]);
    expect(messages.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        mailbox: "dmarc@example.com",
        messageKey: "1789.M1.host",
        status: "imported",
        reports: 1,
        sender: "noreply-dmarc-support@google.com",
      })
    );
  });

  it("reads a moved message under the same key, and skips a message already read", async () => {
    await writeFile(join(maildir, "cur", "1789.M1.host:2,S"), mimeMessage(null));
    messages.find.mockResolvedValue([entity<DmarcInboxMessage>({ messageKey: "1789.M1.host" })]);
    await expect(svc.scan()).resolves.toMatchObject({ scanned: 0 });
    expect(messages.insert).not.toHaveBeenCalled();
  });

  it("records a message without a report as such", async () => {
    await writeFile(join(maildir, "new", "a"), mimeMessage(null));
    await expect(svc.scan()).resolves.toMatchObject({ ignored: 1 });
    expect(messages.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "not-a-report" }));
  });

  it("records a report already stored as a duplicate", async () => {
    reports.findOne.mockResolvedValue(entity<DmarcIncomingReport>({ id: 1 }));
    await writeFile(join(maildir, "new", "a"), mimeMessage({ filename: "r.zip", type: "application/zip", content: zipped() }));
    await expect(svc.scan()).resolves.toMatchObject({ duplicates: 1 });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it("records a report it could not read as failed, with the reason", async () => {
    const broken = GOOGLE_REPORT.replace("<domain>example.com</domain>\n    <adkim>", "<adkim>");
    await writeFile(join(maildir, "new", "a"), mimeMessage({ filename: "r.xml", type: "text/xml", content: strToU8(broken) }));
    await expect(svc.scan()).resolves.toMatchObject({ failed: 1 });
    expect(messages.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", detail: expect.stringContaining("names no domain") })
    );
  });

  it("does not open a message larger than any report", async () => {
    const file = join(maildir, "new", "huge");
    await writeFile(file, "x");
    await truncate(file, 26 * 1024 * 1024);
    await expect(svc.scan()).resolves.toMatchObject({ ignored: 1 });
    expect(messages.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "not-a-report", detail: "too-large" }));
  });

  it("records a message it could not open at all", async () => {
    await mkdir(join(maildir, "new", "a-directory"));
    await expect(svc.scan()).resolves.toMatchObject({ failed: 1 });
  });

  it("reads nothing for an address that is not a mailbox, or when no inbox is set", async () => {
    users.findOne.mockResolvedValue(null);
    await expect(svc.scan()).resolves.toMatchObject({ mailboxes: 1, scanned: 0 });
    inboxes = [];
    await expect(svc.scan()).resolves.toMatchObject({ mailboxes: 0 });
    expect(svc.lastRunAt).not.toBeNull();
  });

  it("reads every domain's dmarc_reports mailbox without being told, before the configured ones", async () => {
    users.find.mockResolvedValue([
      entity<VirtualUser>({ email: "dmarc_reports@b.example" }),
      entity<VirtualUser>({ email: "DMARC_REPORTS@a.example" }),
      entity<VirtualUser>({ email: "dmarcxreports@a.example" }),
    ]);
    inboxes = ["dmarc@example.com", "dmarc_reports@a.example"];
    await expect(svc.mailboxes()).resolves.toEqual(["dmarc_reports@a.example", "dmarc_reports@b.example", "dmarc@example.com"]);
  });

  it("reads the report a filter moved into a folder, Junk included", async () => {
    await mkdir(join(maildir, ".Junk", "new"), { recursive: true });
    await writeFile(
      join(maildir, ".Junk", "new", "1789.M2.host,S=1"),
      mimeMessage({ filename: "r.zip", type: "application/zip", content: zipped() })
    );
    await writeFile(join(maildir, "not-a-folder"), "x");
    await expect(svc.scan()).resolves.toMatchObject({ scanned: 1, imported: 1 });
  });

  it("stops at a hundred messages a pass", async () => {
    for (let i = 0; i < 101; i += 1) await writeFile(join(maildir, "new", `m${i}`), "Subject: x\r\n\r\nhello");
    await expect(svc.scan()).resolves.toMatchObject({ scanned: 100 });
  });

  it("keeps going when the database is away", async () => {
    await writeFile(join(maildir, "new", "a"), mimeMessage(null));
    messages.find.mockRejectedValue(new Error("db down"));
    await expect(svc.scan()).resolves.toMatchObject({ scanned: 0 });
  });

  it("runs one pass at a time", async () => {
    const first = svc.scan();
    await expect(svc.scan()).resolves.toMatchObject({ mailboxes: 0 });
    await first;
  });

  it("deletes over IMAP the mails of a dmarc_reports mailbox whose reports are stored, and only those", async () => {
    inboxes = [];
    users.find.mockResolvedValue([entity<VirtualUser>({ email: "dmarc_reports@example.com" })]);
    await mkdir(join(maildir, ".Junk", "cur"), { recursive: true });
    await mkdir(join(maildir, ".Archive.2026", "new"), { recursive: true });
    await writeFile(
      join(maildir, "new", "1789.M1.host"),
      mimeMessage({ filename: "r.zip", type: "application/zip", content: zipped() })
    );
    await writeFile(join(maildir, "new", "1789.M3.host"), mimeMessage(null));
    await writeFile(join(maildir, ".Junk", "cur", "1789.M2.host:2,S"), "x");
    await writeFile(join(maildir, ".Archive.2026", "new", "1789.M4.host,S=1"), "x");
    await writeFile(join(maildir, "cur", "1789.M5.host:2,S"), "x");
    messages.find.mockResolvedValue([
      entity<DmarcInboxMessage>({ messageKey: "1789.M2.host", status: "duplicate" }),
      entity<DmarcInboxMessage>({ messageKey: "1789.M4.host,S=1", status: "imported" }),
      entity<DmarcInboxMessage>({ messageKey: "1789.M5.host", status: "not-a-report" }),
    ]);

    await expect(svc.scan()).resolves.toMatchObject({ scanned: 2, imported: 1, ignored: 1, deleted: 3 });
    expect(imap.expunge).toHaveBeenCalledTimes(1);
    const [mailbox, targets] = imap.expunge.mock.calls[0] as [string, { folder: string; key: string }[]];
    expect(mailbox).toBe("dmarc_reports@example.com");
    expect([...targets].sort((a, b) => a.key.localeCompare(b.key))).toEqual([
      { folder: "INBOX", key: "1789.M1.host" },
      { folder: "Junk", key: "1789.M2.host" },
      { folder: "Archive/2026", key: "1789.M4.host,S=1" },
    ]);
  });

  it("never deletes from an extra inbox, calls nothing with nothing to delete, and survives an IMAP failure", async () => {
    await writeFile(
      join(maildir, "new", "1789.M1.host"),
      mimeMessage({ filename: "r.zip", type: "application/zip", content: zipped() })
    );
    await expect(svc.scan()).resolves.toMatchObject({ imported: 1, deleted: 0 });
    expect(imap.expunge).not.toHaveBeenCalled();

    inboxes = [];
    users.find.mockResolvedValue([entity<VirtualUser>({ email: "dmarc_reports@example.com" })]);
    messages.find.mockResolvedValue([entity<DmarcInboxMessage>({ messageKey: "1789.M1.host", status: "failed" })]);
    await expect(svc.scan()).resolves.toMatchObject({ scanned: 0, deleted: 0 });
    expect(imap.expunge).not.toHaveBeenCalled();

    messages.find.mockResolvedValue([]);
    imap.expunge.mockRejectedValue(new Error("IMAP NO [AUTHENTICATIONFAILED]"));
    await expect(svc.scan()).resolves.toMatchObject({ scanned: 1, deleted: 0 });
    expect(imap.expunge).toHaveBeenCalledTimes(1);
  });

  it("stores a report without rows without inserting any", async () => {
    const feedback = { ...parseFeedback(GOOGLE_REPORT), records: [] };
    await expect(svc.store(feedback, "<feedback/>", "dmarc@example.com")).resolves.toBe(true);
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it("prunes the reports older than the retention, and survives a failure", async () => {
    await svc.prune(40 * 86_400_000);
    expect((reports.delete.mock.calls[0]?.[0] as { receivedAt: { value: Date } }).receivedAt.value).toEqual(
      new Date(10 * 86_400_000)
    );
    reports.delete.mockRejectedValue(new Error("db"));
    await expect(svc.prune(Date.now())).resolves.toBeUndefined();
  });
});

describe("the helpers", () => {
  it("keys a Maildir file by its name before the flags", () => {
    expect(messageKey("1789.M1.host:2,RS")).toBe("1789.M1.host");
    expect(messageKey("1789.M1.host")).toBe("1789.M1.host");
  });

  it("counts the messages that passed, per mechanism and overall", () => {
    expect(totals(parseFeedback(GOOGLE_REPORT))).toEqual({ messages: 19, dmarcPass: 17, dkimPass: 17, spfPass: 17 });
  });
});
